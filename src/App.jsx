import { Routes, Route, Navigate } from "react-router-dom";
import Landing from "./pages/Landing.jsx";
import AppLayout from "./layouts/AppLayout.jsx";
import Overview from "./pages/Overview.jsx";
import CreateBotDescribe from "./pages/CreateBotDescribe.jsx";
import CreateBotStructure from "./pages/CreateBotStructure.jsx";
import CreateBotSetup from "./pages/CreateBotSetup.jsx";
import CreateBotToken from "./pages/CreateBotToken.jsx";
import CreateBotLaunch from "./pages/CreateBotLaunch.jsx";
import BotFlowEditor from "./pages/BotFlowEditor.jsx";
import MyBots from "./pages/MyBots.jsx";
import Settings from "./pages/Settings.jsx";
import Auth from "./pages/Auth.jsx";
import Inbox from "./pages/Inbox.jsx";
import Welcome from "./pages/Welcome.jsx";
import AdminResponses from "./pages/AdminResponses.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth" element={<Auth />} />

      <Route element={<AppLayout />}>
        <Route path="/overview" element={<Overview />} />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/admin/onboarding" element={<AdminResponses />} />
        <Route path="/create" element={<Navigate to="/create/token" replace />} />
        <Route path="/create/token" element={<CreateBotToken />} />
        <Route path="/create/describe" element={<CreateBotDescribe />} />
        <Route path="/create/structure" element={<CreateBotStructure />} />
        <Route path="/create/flow" element={<BotFlowEditor />} />
        <Route path="/create/setup" element={<CreateBotSetup />} />
        <Route path="/create/launch" element={<CreateBotLaunch />} />
        <Route path="/bots" element={<MyBots />} />
        <Route path="/inbox" element={<Inbox />} />
        <Route path="/bots/:botId/edit" element={<BotFlowEditor />} />
        <Route path="/bots/:botId" element={<MyBots />} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
