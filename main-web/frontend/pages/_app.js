// import '../styles/globals.css';
import './collected-dataset/styles/main.css';
import './collected-dataset/styles/camera.css';
import './collected-dataset/styles/topbar.css';
import '../styles/Home.module.css';
import './collected-dataset/styles/control-buttons.css';
import Header from '../components/Header';
import { ProcessStatusProvider } from '../utils/stateManager';
// /Users/porchportal2/Desktop/🔥everything/Main_Web_EyeTracking/main-web/frontend/pages/utils/stateManager.js

function MyApp({ Component, pageProps }) {
  return (
    <ProcessStatusProvider>
      <Header />
      <Component {...pageProps} />
    </ProcessStatusProvider>
  );
}

export default MyApp;