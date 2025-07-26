interface SidebarProps {
  open?: boolean
  setOpen?: (open: boolean) => void
}

export default function Sidebar({ open = false }: SidebarProps) {
  return (
    <div className={`w-64 bg-gray-800 text-white h-full ${open ? 'block' : 'hidden lg:block'}`}>
      <div className="p-4">
        <h2 className="text-xl font-bold">NXT.AI</h2>
      </div>
      <nav className="mt-8">
        <a href="/dashboard" className="block py-2 px-4 hover:bg-gray-700">Dashboard</a>
        <a href="/crm" className="block py-2 px-4 hover:bg-gray-700">CRM</a>
        <a href="/campaigns" className="block py-2 px-4 hover:bg-gray-700">Campanhas</a>
        <a href="/chat" className="block py-2 px-4 hover:bg-gray-700">Chat</a>
        <a href="/analytics" className="block py-2 px-4 hover:bg-gray-700">Analytics</a>
        <a href="/settings" className="block py-2 px-4 hover:bg-gray-700">Configurações</a>
      </nav>
    </div>
  );
}