import LegalPage from './LegalPage';

function Refund() {
  return (
    <LegalPage title="Refund Policy">
      <p>Last Updated: November 20, 2026</p>

      <h2>1. Digital Products</h2>
      <p>
        Because our courses are digital products that grant immediate access to
        proprietary AI systems and course materials, all sales are generally
        considered final.
      </p>

      <h2>2. Refund Eligibility</h2>
      <p>
        We offer a 7-day refund window ONLY IF the user has accessed the course
        for less than 1 hour (tracked via our database). If you have consumed a
        significant portion of the course, we cannot issue a refund due to the
        API and processing costs involved.
      </p>

      <h2>3. How to Request a Refund</h2>
      <p>
        To request a refund within the eligible window, please email us at
        {' '}
        <a href="mailto:support@skadoosh.in">support@skadoosh.in</a> with your
        registered email address and Razorpay transaction ID.
      </p>

      <h2>4. Processing</h2>
      <p>
        Approved refunds will be processed back to the original payment method
        (via Razorpay) within 5-7 business days. Razorpay's payment gateway fees
        are non-refundable.
      </p>

      <h2>5. Chargebacks</h2>
      <p>
        Initiating a chargeback without contacting us first may result in the
        permanent suspension of your account.
      </p>
    </LegalPage>
  );
}

export default Refund;
