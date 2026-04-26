import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './App.css';
import { HomePage } from './home/pages/HomePage';
import { LobbyPage } from './sipit-or-dipit/pages/LobbyPage';
import { GameRoomPage } from './sipit-or-dipit/pages/GameRoomPage';
import { LobbyPage as PyramidLobbyPage } from './pyramid/pages/LobbyPage';
import { GameRoomPage as PyramidGameRoomPage } from './pyramid/pages/GameRoomPage';
import NotFound from './home/pages/NotFound';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/sipit-or-dipit" element={<LobbyPage />} />
        <Route path="/sipit-or-dipit/room" element={<GameRoomPage />} />
        <Route path="/pyramid" element={<PyramidLobbyPage />} />
        <Route path="/pyramid/room" element={<PyramidGameRoomPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
