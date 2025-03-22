// import '../styles/globals.css';
import './collected-dataset/styles/main.css';
import './collected-dataset/styles/camera.css';
import './collected-dataset/styles/topbar.css';
import '../styles/Home.module.css';
import './collected-dataset/styles/control-buttons.css';
import Header from '../components/Header';

function MyApp({ Component, pageProps }) {
  return (
    <>
      <Header />
      <Component {...pageProps} />
    </>
  );
}

export default MyApp;