import PendingPanel from '../../shell/PendingPanel';
import SectionHead from '../../shell/SectionHead';

const Availability: React.FC = () => (
  <>
    <SectionHead
      title="Availability"
      lede="The hours customers can book against. Nothing is open until these are set, which is why the dashboard does not claim a chair is free."
    />

    <PendingPanel
      title="Working hours not set"
      text="Hours, days off and the cut-off before a booking are not stored yet. Until they are, Trim cannot tell a customer which slots are real."
      facts={[
        { label: 'Week', value: 'Opening and closing time per day' },
        { label: 'Exceptions', value: 'Days off, holidays, one-off changes' },
        { label: 'Rules', value: 'Cut-off, gap between cuts' },
      ]}
    />
  </>
);

export default Availability;
