// pages/_app.js
import './collected-dataset/styles/main.css';
import './collected-dataset/styles/camera.css';
import './collected-dataset/styles/topbar.css';
import '../styles/Home.module.css';
import './collected-dataset/styles/control-buttons.css';
import Header from '../components/Header';
import { ProcessStatusProvider, BackendConnectionProvider } from '../utils/stateManager';
import { ConsentProvider } from '../components/consent/ConsentContext';
import ConnectionStatusIndicator from '../components/ConnectionStatusIndicator';

function MyApp({ Component, pageProps }) {
  return (
    <ProcessStatusProvider>
      <BackendConnectionProvider>
        <ConsentProvider>
          <Header />
          <ConnectionStatusIndicator />
          <Component {...pageProps} />
        </ConsentProvider>
      </BackendConnectionProvider>
    </ProcessStatusProvider>
  );
}

export default MyApp;