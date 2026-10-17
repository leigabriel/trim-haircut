import Nav from '../components/layout/Nav';
import About from '../components/sections/About/About';
import Footer from '../components/sections/Footer/Footer';
import Hero from '../components/sections/Hero/Hero';
import Styles from '../components/sections/Styles/Styles';
import { IonContent, IonPage } from '@ionic/react';

interface HomeProps {
  isEntered: boolean;
  onProgress: (ratio: number) => void;
  onModelsReady: () => void;
}

// About is a pinned back layer the hero overlaps. Styles and the footer
// follow in normal flow. The nav stays white over the blue hero.
const Home: React.FC<HomeProps> = ({ isEntered, onProgress, onModelsReady }) => (
  <IonPage>
    <IonContent>
      <Nav />
      <About />
      <Hero isEntered={isEntered} onProgress={onProgress} onReady={onModelsReady} />
      <Styles />
      <Footer />
    </IonContent>
  </IonPage>
);

export default Home;