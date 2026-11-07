import { createRoot } from 'react-dom/client';
import NativeApp from './NativeApp';
import '../index.css';

createRoot(document.getElementById('root')!).render(<NativeApp platform="android" />);
