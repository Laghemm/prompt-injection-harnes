import { Route, Routes } from "react-router-dom";
import { CommandPalette } from "./components/CommandPalette";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import AssistantDetail from "./pages/AssistantDetail";
import Assistants from "./pages/Assistants";
import AttackLab from "./pages/AttackLab";
import CampaignDetail from "./pages/CampaignDetail";
import CampaignRun from "./pages/CampaignRun";
import CampaignWizard from "./pages/CampaignWizard";
import Campaigns from "./pages/Campaigns";
import Coverage from "./pages/Coverage";
import FindingDetail from "./pages/FindingDetail";
import Findings from "./pages/Findings";
import Overview from "./pages/Overview";
import Regressions from "./pages/Regressions";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <div className="flex h-screen bg-bg text-fg font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/assistants" element={<Assistants />} />
            <Route path="/assistants/:name" element={<AssistantDetail />} />
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/campaigns/new" element={<CampaignWizard />} />
            <Route path="/campaigns/run/:jobId" element={<CampaignRun />} />
            <Route path="/campaigns/:id" element={<CampaignDetail />} />
            <Route path="/findings" element={<Findings />} />
            <Route path="/findings/:id" element={<FindingDetail />} />
            <Route path="/attack-lab" element={<AttackLab />} />
            <Route path="/coverage" element={<Coverage />} />
            <Route path="/regressions" element={<Regressions />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
