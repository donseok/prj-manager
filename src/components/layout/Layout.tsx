import { Outlet } from 'react-router-dom';
import ChatbotWidget from '../chatbot/ChatbotWidget';
import Header from './Header';
import Sidebar from './Sidebar';

export default function Layout() {
  return (
    <div className="min-h-screen lg:flex lg:h-screen lg:flex-col lg:overflow-hidden text-[color:var(--text-primary)]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-12rem] top-[-10rem] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(15,118,110,0.22),transparent_68%)] blur-3xl" />
        <div className="absolute right-[-10rem] top-[2rem] h-[24rem] w-[24rem] rounded-full bg-[radial-gradient(circle,rgba(203,109,55,0.18),transparent_72%)] blur-3xl" />
        <div className="absolute bottom-[-12rem] left-1/3 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(18,61,100,0.12),transparent_72%)] blur-3xl" />
      </div>
      <Header />
      <div className="relative z-0 flex min-h-0 flex-1 px-4 pt-4 pb-4 lg:px-6 lg:overflow-hidden">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 lg:flex-row">
          <Sidebar />
          <main className="min-w-0 flex-1">
            <div className="app-panel-strong h-full overflow-y-auto p-0 md:p-7 lg:p-8">
              <Outlet />
            </div>
          </main>
        </div>
        <ChatbotWidget />
      </div>
    </div>
  );
}
