import { Outlet } from 'react-router-dom';
import ChatbotWidget from '../chatbot/ChatbotWidget';
import Header from './Header';
import Sidebar from './Sidebar';

export default function Layout() {
  return (
    <div className="flex h-screen flex-col overflow-hidden text-[color:var(--text-primary)]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-12rem] top-[-10rem] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(15,118,110,0.22),transparent_68%)] blur-3xl" />
        <div className="absolute right-[-10rem] top-[2rem] h-[24rem] w-[24rem] rounded-full bg-[radial-gradient(circle,rgba(203,109,55,0.18),transparent_72%)] blur-3xl" />
        <div className="absolute bottom-[-12rem] left-1/3 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(18,61,100,0.12),transparent_72%)] blur-3xl" />
      </div>
      <Header />
      <div className="flex flex-1 gap-6 overflow-hidden px-4 pb-4 lg:px-6">
        <Sidebar />
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="app-panel-strong flex flex-1 flex-col overflow-hidden p-0 md:p-7 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>
      <ChatbotWidget />
    </div>
  );
}
