/**
 * 로컬 Supabase 접속 상수. 아래 두 JWT 는 supabase CLI 가 모든 로컬 프로젝트에
 * 공통으로 쓰는 공개 데모 키(secret 아님, supabase docs 에 그대로 실려 있음).
 * CLI 버전에 따라 값이 다르면 `npx supabase status` 출력으로 env 오버라이드할 것.
 */
export const LOCAL_SUPABASE_URL =
  process.env["LOCAL_SUPABASE_URL"] ?? "http://127.0.0.1:54321";

export const LOCAL_SUPABASE_ANON_KEY =
  process.env["LOCAL_SUPABASE_ANON_KEY"] ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

export const LOCAL_SUPABASE_SERVICE_KEY =
  process.env["LOCAL_SUPABASE_SERVICE_KEY"] ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
