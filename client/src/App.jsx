import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Scan from './pages/Scan.jsx';
import Analytics from './pages/Analytics.jsx';
import BinDetail from './pages/BinDetail.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="scan" element={<Scan />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="bins/:id" element={<BinDetail />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
