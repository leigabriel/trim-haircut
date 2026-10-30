import CameraFilter from '../camera/CameraFilter';
import SectionHead from '../../shell/SectionHead';

/**
 * Live haircut filter. The cut is fitted to the landmarks of the face in front
 * of the camera and follows the head as it turns, rather than sitting on the
 * screen as a fixed picture.
 */
const Camera: React.FC = () => (
  <>
    <SectionHead
      title="Camera"
      lede="Try a haircut live. The cut is fitted to your own forehead, ears and jaw and follows your head as you turn. Nothing is uploaded."
    />
    <CameraFilter />
  </>
);

export default Camera;
