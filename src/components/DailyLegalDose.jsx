import React from 'react';

// Daily Dose of Legal Insight - static list embedded in frontend
const INSIGHTS = [
  { "insight_text": "A 'Zero FIR' can be filed at any police station for a cognizable offence, regardless of jurisdiction. The station must register it and transfer it.", "source": "Criminal Law (Amendment) Act, 2013" },
  { "insight_text": "A police officer is legally bound to register an FIR for a cognizable offence. Refusal to do so is a punishable offence.", "source": "Indian Penal Code, 1860 (Section 166A)" },
  { "insight_text": "An arrested person has the right to inform a friend, relative, or lawyer about their arrest immediately.", "source": "Code of Criminal Procedure, 1973 (Section 50A)" },
  { "insight_text": "A woman cannot be arrested after sunset or before sunrise, except in exceptional cases with a magistrate's prior permission.", "source": "Code of Criminal Procedure, 1973 (Section 46(4))" },
  { "insight_text": "You have the 'Right to Remain Silent' if arrested. You cannot be forced to be a witness against yourself.", "source": "Constitution of India (Article 20(3))" },
  { "insight_text": "A person arrested must be produced before the nearest magistrate within 24 hours of the arrest.", "source": "Constitution of India (Article 22(2))" },
  { "insight_text": "Sellers cannot legally charge more than the Maximum Retail Price (MRP) printed on a product.", "source": "Consumer Protection Act, 2019" },
  { "insight_text": "Misleading advertisements are an 'unfair trade practice.' You can file a complaint against the company and the endorser.", "source": "Consumer Protection Act, 2019" },
  { "insight_text": "E-commerce sites are required to display the 'country of origin' for all products and have a clear grievance redressal mechanism.", "source": "Consumer Protection (E-Commerce) Rules, 2020" },
  { "insight_text": "For a contract to be legally valid in India, it must have an offer, acceptance, lawful consideration, and free consent.", "source": "Indian Contract Act, 1872 (Section 10)" },
  { "insight_text": "An agreement with a minor (under 18 years) is 'void ab initio,' meaning it is void from the very beginning and cannot be enforced.", "source": "Indian Contract Act, 1872 (Section 11)" },
  { "insight_text": "Digital signatures (like a DSC) are legally valid and equivalent to handwritten signatures for most electronic documents.", "source": "Information Technology Act, 2000" },
  { "insight_text": "A rental agreement for a period of more than 11 months must be in writing and registered to be legally valid.", "source": "Registration Act, 1908" },
  { "insight_text": "An unstamped or improperly stamped agreement (where required) is not admissible as evidence in a court of law.", "source": "Indian Stamp Act, 1899" },
  { "insight_text": "A bounced cheque is a criminal offence in India, punishable with fines or imprisonment.", "source": "Negotiable Instruments Act, 1881 (Section 138)" },
  { "insight_text": "A 'nominee' in a bank account or property is only a custodian, not the legal owner. The asset will pass to the legal heirs as per the 'Will' or succession law.", "source": "Legal Principle" },
  { "insight_text": "A 'Will' (Wasiyat) must be in writing, signed by the person making it, and attested by at least two witnesses to be valid.", "source": "Indian Succession Act, 1925" },
  { "insight_text": "Daughters have the same right to ancestral property as sons, regardless of when they were born.", "source": "Hindu Succession (Amendment) Act, 2005" },
  { "insight_text": "Homebuyers are protected against project delays and false promises by builders under the RERA Act.", "source": "Real Estate (Regulation and Development) Act, 2016" },
  { "insight_text": "Any citizen can request information from a public authority (like a government office) by filing an RTI application for a nominal fee.", "source": "Right to Information (RTI) Act, 2005" },
  { "insight_text": "An employer cannot legally fire an employee simply because she is pregnant.", "source": "Maternity Benefit Act, 1961" },
  { "insight_text": "The Special Marriage Act allows any two Indian citizens to marry, regardless of their different religions or faiths.", "source": "Special Marriage Act, 1954" },
  { "insight_text": "Every person in India has a fundamental 'Right to Life and Personal Liberty,' which includes the right to live with dignity.", "source": "Constitution of India (Article 21)" },
  { "insight_text": "The law must treat everyone equally. Discrimination based on religion, race, caste, sex, or place of birth is prohibited.", "source": "Constitution of India (Article 14 & 15)" },
  { "insight_text": "If you are injured in an accident (road, fire, acid attack), any hospital (public or private) must provide immediate first aid and treatment, free of cost.", "source": "Supreme Court Ruling (Parmanand Katara vs. UOI)" },
  { "insight_text": "Companies must get your clear and specific consent before collecting or using your digital personal data.", "source": "Digital Personal Data Protection (DPDP) Act, 2023" },
  { "insight_text": "You have the right to withdraw your consent for data processing at any time, and it must be as easy to withdraw as it was to give.", "source": "Digital Personal Data Protection (DPDP) Act, 2023" },
  { "insight_text": "Companies must get verifiable consent from a parent or guardian before processing the personal data of anyone under 18 years old.", "source": "Digital Personal Data Protection (DPDP) Act, 2023" },
  { "insight_text": "Every child in India between the ages of 6 and 14 has a fundamental right to free and compulsory education.", "source": "Constitution of India (Article 21A)" },
  { "insight_text": "Any hotel or restaurant must provide any person with free, clean drinking water and access to their washroom, even if they are not a customer.", "source": "Indian Sarais Act, 1867" }
];

const DailyLegalDose = ({ className }) => {
  // deterministic daily index based on date (UTC)
  const today = new Date();
  const days = Math.floor(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) / (24 * 60 * 60 * 1000));
  const idx = days % INSIGHTS.length;
  const insight = INSIGHTS[idx];

  return (
    <div className={"max-w-xl mx-auto text-left bg-white/80 border rounded-xl p-4 shadow-sm " + (className || '')}>
      <div className="flex items-start gap-3">
        <img src="/idea.png" className="flex-shrink-2 w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold" alt="" />
        <div className="flex-1">
          <div className="text-xs text-gray-500 mb-1">Daily legal insight</div>
          <div className="text-sm text-gray-900 mb-2">{insight.insight_text}</div>
          <div className="text-xs text-gray-500">Source: <span className="text-gray-700">{insight.source}</span></div>
        </div>
      </div>
      {/* <div className="mt-3 text-right text-xs text-gray-400">#{idx + 1} of {INSIGHTS.length}</div> */}
    </div>
  );
};

export default DailyLegalDose;
