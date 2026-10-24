import PendingPanel from '../../shell/PendingPanel';
import SectionHead from '../../shell/SectionHead';

const Services: React.FC = () => (
  <>
    <SectionHead
      title="Services"
      lede="What can be booked at your chair and what it costs. Prices are per shop, so this needs the shop record before it can be edited."
    />

    <PendingPanel
      title="No services on the menu"
      text="Services and prices are not stored yet. Once they are, this page is the menu a customer picks from when they book you."
      facts={[
        { label: 'Row', value: 'Service, duration, price' },
        { label: 'Options', value: 'Active, hidden, seasonal' },
        { label: 'Scope', value: 'Per shop, not per barber' },
      ]}
    />
  </>
);

export default Services;
