// pages/_app.js
import './collected-dataset/styles/main.css';
import './collected-dataset/styles/camera.css';
import './collected-dataset/styles/topbar.css';
import '../styles/Home.module.css';
import './collected-dataset/styles/control-buttons.css';
import { ProcessStatusProvider, BackendConnectionProvider } from '../utils/stateManager';
import { ConsentProvider } from '../components/consent_ui/ConsentContext';
import { NotificationProvider } from '../utils/NotificationContext';
import NotiMessage from '../utils/notiMessage';
// import ConnectionStatusIndicator from '../components/ConnectionStatusIndicator';
import Layout from '../components/layout/Layout';
// import { generateCalibrationPoints } from '../components/collected-dataset-customized/Action/CalibratePoints';

function MyApp({ Component, pageProps }) {
  return (
    <NotificationProvider>
      <ProcessStatusProvider>
        <BackendConnectionProvider>
          <ConsentProvider>
            <Layout>
              <Component {...pageProps} />
            </Layout>
            <NotiMessage />
          </ConsentProvider>
        </BackendConnectionProvider>
      </ProcessStatusProvider>
    </NotificationProvider>
  );
}

export default MyApp;