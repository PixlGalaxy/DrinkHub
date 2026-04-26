import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './App.css';
import { HomePage } from './home/pages/HomePage';
import { LobbyPage } from './sipit-or-dipit/pages/LobbyPage';
import { GameRoomPage } from './sipit-or-dipit/pages/GameRoomPage';
import NotFound from './home/pages/NotFound';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/sipit-or-dipit" element={<LobbyPage />} />
        <Route path="/sipit-or-dipit/room" element={<GameRoomPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
