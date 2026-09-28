import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Instruments } from './pages/Instruments';
import { InstrumentDetail } from './pages/InstrumentDetail';
import { NewTest } from './pages/NewTest';
import { Diagnostics } from './pages/Diagnostics';
import { Reports } from './pages/Reports';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/instruments" element={<Instruments />} />
          <Route path="/instruments/:id" element={<InstrumentDetail />} />
          <Route path="/test/new" element={<NewTest />} />
          <Route path="/diagnostics" element={<Diagnostics />} />
          <Route path="/reports" element={<Reports />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
