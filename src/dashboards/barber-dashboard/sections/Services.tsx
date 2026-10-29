import PendingPanel from '../../shell/PendingPanel';
import SectionHead from '../../shell/SectionHead';

const Services: React.FC = () => (
  <>
    <SectionHead
      title="Services"
      lede="The menu customers book from. Prices and durations live in the services table; editing the menu from this dashboard is not open yet."
    />

    <PendingPanel
      title="Menu is stored, editing is not open"
      text="The customer booking form reads the active rows from the services table. Change a price or duration in the SQL editor until this page can edit them."
      facts={[
        { label: 'Source', value: 'public.services' },
        { label: 'Customer sees', value: 'Active services only' },
        { label: 'Booking', value: 'Price and duration locked at request time' },
      ]}
    />
  </>
);

export default Services;
