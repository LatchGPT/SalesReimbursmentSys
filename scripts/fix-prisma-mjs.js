import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const runtimeDir = path.resolve(__dirname, '../node_modules/@prisma/client/runtime');

if (fs.existsSync(runtimeDir)) {
  const mjsWasmWrapper = `import mod from './query_compiler_fast_bg.postgresql.wasm-base64.js';
export const { wasm } = mod;
export default mod;
`;

  const mjsCompilerWrapper = `import mod from './query_compiler_fast_bg.postgresql.js';

export const {
  QueryCompiler,
  __wbg_Error_e83987f665cf5504,
  __wbg_Number_bb48ca12f395cd08,
  __wbg_String_8f0eb39a4a4c2f66,
  __wbg___wbindgen_boolean_get_6d5a1ee65bab5f68,
  __wbg___wbindgen_debug_string_df47ffb5e35e6763,
  __wbg___wbindgen_in_bb933bd9e1b3bc0f,
  __wbg___wbindgen_is_object_c818261d21f283a4,
  __wbg___wbindgen_is_string_fbb76cb2940daafd,
  __wbg___wbindgen_is_undefined_2d472862bd29a478,
  __wbg___wbindgen_jsval_loose_eq_b664b38a2f582147,
  __wbg___wbindgen_number_get_a20bf9b85341449d,
  __wbg___wbindgen_string_get_e4f06c90489ad01b,
  __wbg___wbindgen_throw_b855445ff6a94295,
  __wbg_entries_e171b586f8f6bdbf,
  __wbg_getTime_14776bfb48a1bff9,
  __wbg_get_7bed016f185add81,
  __wbg_get_with_ref_key_1dc361bd10053bfe,
  __wbg_instanceof_ArrayBuffer_70beb1189ca63b38,
  __wbg_instanceof_Uint8Array_20c8e73002f7af98,
  __wbg_isSafeInteger_d216eda7911dde36,
  __wbg_length_69bca3cb64fc8748,
  __wbg_length_cdd215e10d9dd507,
  __wbg_new_0_f9740686d739025c,
  __wbg_new_1acc0b6eea89d040,
  __wbg_new_5a79be3ab53b8aa5,
  __wbg_new_68651c719dcda04e,
  __wbg_new_e17d9f43105b08be,
  __wbg_prototypesetcall_2a6620b6922694b2,
  __wbg_set_3f1d0b984ed272ed,
  __wbg_set_907fb406c34a251d,
  __wbg_set_c213c871859d6500,
  __wbg_set_message_82ae475bb413aa5c,
  __wbg_set_wasm,
  __wbindgen_cast_2241b6af4c4b2941,
  __wbindgen_cast_4625c577ab2ec9ee,
  __wbindgen_cast_9ae0607507abb057,
  __wbindgen_cast_d6cd19b81560fd6e,
  __wbindgen_init_externref_table,
} = mod;

export default mod;
`;

  fs.writeFileSync(path.join(runtimeDir, 'query_compiler_fast_bg.postgresql.wasm-base64.mjs'), mjsWasmWrapper);
  fs.writeFileSync(path.join(runtimeDir, 'query_compiler_fast_bg.postgresql.mjs'), mjsCompilerWrapper);
}
