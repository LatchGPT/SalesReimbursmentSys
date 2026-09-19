import type { Request as ExpressRequest, Response as ExpressResponse, Router } from 'express';
import { UserRole } from '../../serverTypes';
import { withPersistenceScope } from '../../db/persistenceScope';
import { state } from '../state';
import { hydrateServerlessState } from '../stateLoader';
import { activityRouter } from '../../../../src/features/activity/server';
import { adminRouter, companiesRouter, fieldDefinitionsRouter, masterDataRouter } from '../../../../src/features/admin/server';
import { analyticsRouter } from '../../../../src/features/analytics/server';
import { authRouter } from '../../../../src/features/auth/server';
import { claimsRouter, expensesRouter } from '../../../../src/features/claims/server';
import { cashAdvancesRouter, liquidationsRouter } from '../../../../src/features/disbursements/server';
import { momsRouter } from '../../../../src/features/moms/server';
import { reviewMeetingsRouter } from '../../../../src/features/review-meetings/server';
import { supportRouter } from '../../../../src/features/support/server';
import { delegationsRouter, usersRouter } from '../../../../src/features/users/server';
import { serverEnv } from '../../../../src/config/env';

type RouteLayer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: Function }>;
  };
};

const apiRouters: Router[] = [
  authRouter,
  companiesRouter,
  masterDataRouter,
  fieldDefinitionsRouter,
  usersRouter,
  momsRouter,
  expensesRouter,
  claimsRouter,
  cashAdvancesRouter,
  liquidationsRouter,
  delegationsRouter,
  reviewMeetingsRouter,
  supportRouter,
  activityRouter,
  analyticsRouter,
  adminRouter,
];

const NO_DATABASE_PATHS = new Set([
  '/auth/config',
  '/auth/microsoft/start',
]);

const JSON_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
};

function json(body: unknown, status = 200, extraHeaders?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...Object.fromEntries(new Headers(extraHeaders).entries()) },
  });
}

function matchRoute(pattern: string, pathname: string): Record<string, string> | null {
  const names: string[] = [];
  const expression = pattern
    .split('/')
    .map((segment) => {
      if (segment.startsWith(':')) {
        names.push(segment.slice(1));
        return '([^/]+)';
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  const match = new RegExp(`^${expression}/?$`).exec(pathname);
  if (!match) return null;
  return Object.fromEntries(names.map((name, index) => [name, decodeURIComponent(match[index + 1])]));
}

function queryObject(searchParams: URLSearchParams): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  for (const [key, value] of searchParams) {
    const current = result[key];
    result[key] = current === undefined ? value : Array.isArray(current) ? [...current, value] : [current, value];
  }
  return result;
}

async function requestBody(request: Request): Promise<unknown> {
  if (request.method === 'GET' || request.method === 'HEAD') return {};
  const text = await request.text();
  if (!text) return {};
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return text;
  try {
    return JSON.parse(text);
  } catch {
    throw new SyntaxError('Invalid JSON body.');
  }
}

export async function enforceApiRateLimit(request: Request, pathname: string): Promise<Response | null> {
  const redisUrl = serverEnv.upstashRedisUrl;
  const redisToken = serverEnv.upstashRedisToken;
  if (!redisUrl || !redisToken) return null;

  const isAuth = pathname.startsWith('/auth/') && pathname !== '/auth/config';
  const isWrite = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
  if (!isAuth && !isWrite) return null;

  const limit = isAuth ? 30 : 300;
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const identity = forwardedFor || 'unknown';
  const window = Math.floor(Date.now() / (15 * 60 * 1000));
  const key = `rate:${isAuth ? 'auth' : 'write'}:${identity}:${window}`;

  try {
    const response = await fetch(`${redisUrl.replace(/\/$/, '')}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${redisToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, 900, 'NX'],
      ]),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Upstash returned ${response.status}`);
    const result = await response.json() as Array<{ result?: number }>;
    const count = Number(result[0]?.result || 0);
    if (count > limit) {
      return json({
        error: isAuth
          ? 'Too many authentication attempts. Please try again in a few minutes.'
          : 'Too many requests. Please try again in a few minutes.',
      }, 429, { 'Retry-After': '900' });
    }
  } catch (error) {
    console.error('[rate-limit] Upstash request failed; allowing request:', error);
  }

  return null;
}

function enforceFinanceReadOnly(request: Request, pathname: string): Response | null {
  const userId = request.headers.get('x-user-id');
  const user = state.users.find((candidate) =>
    candidate.id === userId
    || candidate.entra_object_id === userId
    || candidate.user_principal_name === userId);
  const isRead = ['GET', 'HEAD', 'OPTIONS'].includes(request.method);
  const isSelfService = pathname === '/me/notification-prefs' || pathname.startsWith('/support');
  if (user?.role === UserRole.FINANCE && !isRead && !isSelfService) {
    return json({ error: 'Finance access is view-only.' }, 403);
  }
  return null;
}

async function executeController(
  handler: Function,
  req: ExpressRequest,
  res: ExpressResponse,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let nextCalled = false;
    const next = (error?: unknown) => {
      nextCalled = true;
      if (error) reject(error);
      else resolve();
    };

    try {
      const returned = handler(req, res, next);
      if (returned && typeof returned.then === 'function') {
        Promise.resolve(returned).then(() => resolve(), reject);
      } else if (!nextCalled) {
        resolve();
      }
    } catch (error) {
      reject(error);
    }
  });
}

async function dispatchApiRouteInner(request: Request, pathname: string): Promise<Response> {
  try {
    if (!NO_DATABASE_PATHS.has(pathname)) await hydrateServerlessState();

    const limited = await enforceApiRateLimit(request, pathname);
    if (limited) return limited;
    const financeDenied = enforceFinanceReadOnly(request, pathname);
    if (financeDenied) return financeDenied;

    const url = new URL(request.url);
    const body = await requestBody(request);
    let pathExists = false;

    for (const router of apiRouters) {
      for (const layer of (router as unknown as { stack: RouteLayer[] }).stack) {
        if (!layer.route) continue;
        const params = matchRoute(layer.route.path, pathname);
        if (!params) continue;
        pathExists = true;
        if (!layer.route.methods[request.method.toLowerCase()]) continue;

        let response: Response | undefined;
        let statusCode = 200;
        const req = {
          method: request.method,
          path: pathname,
          url: `${pathname}${url.search}`,
          originalUrl: `/api${pathname}${url.search}`,
          params,
          query: queryObject(url.searchParams),
          body,
          headers: Object.fromEntries(request.headers.entries()),
          header(name: string) {
            return request.headers.get(name) ?? undefined;
          },
          get(name: string) {
            return request.headers.get(name) ?? undefined;
          },
        } as unknown as ExpressRequest;
        const res = {
          headersSent: false,
          status(code: number) {
            statusCode = code;
            return this;
          },
          json(this: { headersSent: boolean }, payload: unknown) {
            this.headersSent = true;
            response = json(payload, statusCode);
            return this;
          },
        } as unknown as ExpressResponse;

        for (const controller of layer.route.stack) {
          await executeController(controller.handle, req, res);
          if (response) return response;
        }
        return response || new Response(null, { status: statusCode });
      }
    }

    return pathExists
      ? json({ error: 'Method not allowed' }, 405)
      : json({ error: 'Not found' }, 404);
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: error.message }, 400);
    console.error('[route-handler] Unhandled API error:', error);
    return json({ error: 'Service unavailable' }, 503);
  }
}

export function dispatchApiRoute(request: Request, pathname: string): Promise<Response> {
  return withPersistenceScope(() => dispatchApiRouteInner(request, pathname));
}
