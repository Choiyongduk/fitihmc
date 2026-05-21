// ============================================================
// supabase-client.js — Supabase 연결 + 권한 헬퍼
// ============================================================

const SUPABASE_URL = 'https://ksvjnuwqqoeixtkwrjfk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzdmpudXdxcW9laXh0a3dyamZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyOTM3MDcsImV4cCI6MjA5NDg2OTcwN30.Indm6ezMeZTZjZFKZC32J15cu5lglBdNkxGPPDzKu2E';

// Supabase JS 클라이언트 (CDN으로 로드된 window.supabase 사용)
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// ── 전역 상태 (다른 파일에서 참조)
window.sb = sb;
window.CURRENT_USER = null;       // auth.users 레코드
window.CURRENT_PROFILE = null;    // profiles 테이블 레코드

// ── 권한 헬퍼 (다른 파일에서 if(isFiti()) 식으로 사용)
window.isApproved   = () => window.CURRENT_PROFILE?.status === 'approved';
window.isFitiAdmin  = () => window.CURRENT_PROFILE?.role === 'fiti_admin';
window.isFitiTester = () => window.CURRENT_PROFILE?.role === 'fiti_tester';
window.isFiti       = () => ['fiti_admin','fiti_tester'].includes(window.CURRENT_PROFILE?.role);
window.isHmc        = () => window.CURRENT_PROFILE?.role === 'hmc_user';
