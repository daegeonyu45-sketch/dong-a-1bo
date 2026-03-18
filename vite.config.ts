
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// Fix: Import process explicitly from node:process to avoid environment-specific typing issues
import process from 'node:process';

export default defineConfig(() => {
  // 시스템 환경 변수 및 .env 파일을 로드합니다. 
  // 세 번째 인자를 ''로 설정하면 VITE_ 접두사가 없는 변수도 로드할 수 있습니다.
  // Fix: Property 'cwd' does not exist on type 'Process' - Using explicitly imported process
  return {
    plugins: [react()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(process.env.GEMINI_API_KEY || process.env.API_KEY),
      'process.env.API_KEY': JSON.stringify(process.env.API_KEY),
      'import.meta.env.VITE_API_KEY': JSON.stringify(process.env.API_KEY || process.env.GEMINI_API_KEY)
    }
  };
});
