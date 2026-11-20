import LegalPage from './LegalPage';

function Privacy() {
  return (
    <LegalPage title="Privacy Policy">
      <p>Last Updated: November 20, 2026</p>

      <h2>1. Introduction</h2>
      <p>
        Welcome to Skadoosh. We are committed to protecting your personal
        information and your right to privacy. This policy explains what
        information we collect and how we use it.
      </p>

      <h2>2. Information We Collect</h2>
      <ul>
        <li>
          <strong>Personal Information:</strong> When you register, we collect
          your name, email address, and username via Supabase Auth.
        </li>
        <li>
          <strong>Payment Information:</strong> We use Razorpay to process
          payments. We do NOT store your credit card or UPI details on our
          servers. Razorpay processes this securely.
        </li>
        <li>
          <strong>Usage Data:</strong> We collect data on your course progress,
          XP, and interactions with the AI tutor to improve the learning
          experience.
        </li>
      </ul>

      <h2>3. How We Use Your Information</h2>
      <ul>
        <li>To provide and maintain our AI-powered educational services.</li>
        <li>To process your transactions securely via Razorpay.</li>
        <li>To personalize your learning experience.</li>
        <li>To communicate with you regarding updates or support.</li>
      </ul>

      <h2>4. Third-Party Services</h2>
      <p>
        We share data with: Supabase (Database and Authentication), Razorpay
        (Payment Processing), and AI Providers (Groq, Google Gemini) to generate
        educational responses. We do not share personally identifiable
        information with AI providers; only the necessary prompt context.
      </p>

      <h2>5. Data Security</h2>
      <p>
        We implement appropriate technical measures to protect your data.
        However, no method of transmission over the internet is 100% secure.
      </p>

      <h2>6. Contact Us</h2>
      <p>
        If you have questions about this policy, contact us at
        {' '}
        <a href="mailto:support@skadoosh.in">support@skadoosh.in</a>.
      </p>
    </LegalPage>
  );
}

export default Privacy;
