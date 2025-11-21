import React, { useState } from 'react';
import { motion } from 'framer-motion';
import api from '../Axios/axios';
import { toast } from 'react-toastify';
import useAuthStore from '../context/AuthContext';

const Support = () => {
  const [activeSection, setActiveSection] = useState('features');
  const [expandedFeature, setExpandedFeature] = useState(null);
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [contactForm, setContactForm] = useState({ subject: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const authUser = useAuthStore(s => s.user) || {};
  const isLawyer = authUser?.role === 'lawyer';

  // Helper function to render feature icons
  const getFeatureIcon = (iconName) => {
    const iconClass = "w-6 h-6 text-blue-600";
    
    switch(iconName) {
      case 'search':
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        );
      case 'chat':
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        );
      case 'document':
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      case 'folder':
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        );
      case 'settings':
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        );
      case 'bell':
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        );
      case 'user':
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        );
      default:
        return null;
    }
  };

  const features = [
    {
      id: 'find-lawyer',
      title: 'Finding & Connecting with Lawyers',
      icon: 'search',
      steps: [
        {
          title: '1. Navigate to Find Lawyer',
          description: 'Click on "Find Lawyer" from the home page or sidebar menu.',
          tips: ['You can access this feature anytime from the main navigation']
        },
        {
          title: '2. Browse Lawyer Profiles',
          description: 'View comprehensive profiles including specialties, experience, ratings, and consultation fees.',
          tips: [
            'Use filters to narrow down by location, specialty, or experience',
            'Check the success rate and client reviews',
            'Look for lawyers with verified badges for added trust'
          ]
        },
        {
          title: '3. Send Connection Request',
          description: 'Click "Connect" on a lawyer\'s profile to send a connection request with a personalized message.',
          tips: [
            'Write a clear message explaining your legal need',
            'Be specific about your case type',
            'Mention your preferred consultation mode (video, chat, in-person)'
          ]
        },
        {
          title: '4. Track Your Requests',
          description: 'Monitor the status of your connection requests in the "Find Lawyer" page under "My Connections".',
          tips: [
            'You\'ll receive notifications when lawyers respond',
            'Check Recent Activity on the home page for quick updates'
          ]
        },
        {
          title: '5. Start Chatting',
          description: 'Once a lawyer accepts your request, you can start chatting directly.',
          tips: [
            'Share relevant documents securely',
            'Schedule consultations through chat',
            'Keep all communication within the platform for record-keeping'
          ]
        }
      ]
    },
    {
      id: 'chat',
      title: 'Real-Time Chat & Communication',
      icon: 'chat',
      steps: [
        {
          title: '1. Access Your Chats',
          description: 'Click on "Chat" from the sidebar or navigate to the chat icon in the header.',
          tips: ['Unread messages show a red badge with the count']
        },
        {
          title: '2. Select a Conversation',
          description: 'Choose from your list of active conversations with lawyers or clients.',
          tips: [
            'Recent messages appear at the top',
            'Use the search bar to find specific conversations',
            'Online status indicators show who\'s currently available'
          ]
        },
        {
          title: '3. Send Messages',
          description: 'Type your message in the input box and press Enter or click Send.',
          tips: [
            'Messages are encrypted for privacy',
            'Use professional language',
            'Be clear and concise in your communication'
          ]
        },
        {
          title: '4. Share Files & Documents',
          description: 'Click the attachment icon to share documents, images, or PDFs.',
          tips: [
            'Maximum file size: 10MB',
            'Supported formats: PDF, DOC, DOCX, JPG, PNG',
            'Documents are stored securely in Google Cloud Storage'
          ]
        },
        {
          title: '5. Real-Time Updates',
          description: 'See typing indicators and receive messages instantly without refreshing.',
          tips: [
            'Messages sync across all your devices',
            'Delivery receipts show when messages are sent',
            'Timestamps help track conversation flow'
          ]
        }
      ]
    },
    {
      id: 'autofill',
      title: 'AutoFill Forms',
      icon: 'document',
      steps: [
        {
          title: '1. Upload Your PDF Form',
          description: 'Navigate to "AutoFill Forms" and click "Upload Form" to select a PDF from your device.',
          tips: [
            'Ensure the PDF is not password-protected',
            'Clear scans work better than photos',
            'Supported format: PDF only'
          ]
        },
        {
          title: '2. AI Detection',
          description: 'Our AI automatically detects all fillable fields in your form including text fields, checkboxes, and signature areas.',
          tips: [
            'The system highlights detected fields in different colors',
            'Form processing takes 5-10 seconds',
            'You can manually adjust field positions if needed'
          ]
        },
        {
          title: '3. Fill Form Fields',
          description: 'Click on any detected field to enter information. The form auto-saves as you type.',
          tips: [
            'Use the field navigation to jump between fields',
            'Data is encrypted and stored securely',
            'You can save partially completed forms and return later'
          ]
        },
        {
          title: '4. Upload Images',
          description: 'For fields requiring photos (passport photo, signature), click the camera icon to upload images.',
          tips: [
            'Drag uploaded images to position them correctly',
            'Resize images by dragging corners',
            'Supported formats: JPG, PNG, GIF (max 5MB)'
          ]
        },
        {
          title: '5. Download Filled Form',
          description: 'Click "Download PDF" to get your completed form with all field data and images.',
          tips: [
            'The downloaded PDF maintains original format',
            'All your data is included in the final PDF',
            'Keep a backup of filled forms for your records'
          ]
        }
      ]
    },
    {
      id: 'legal-desk',
      title: 'Legal Desk - Document Analysis',
      icon: 'folder',
      steps: [
        {
          title: '1. Create a Legal Desk',
          description: 'Click "Legal Desks" and create a new desk for each case or document set.',
          tips: [
            'Name your desk clearly (e.g., "Property Dispute", "Employment Contract")',
            'Organize documents by case for easy access'
          ]
        },
        {
          title: '2. Upload Documents',
          description: 'Add PDFs, Word documents, or images related to your case.',
          tips: [
            'Upload multiple documents at once',
            'Supported formats: PDF, DOC, DOCX, JPG, PNG',
            'Maximum 20MB per file'
          ]
        },
        {
          title: '3. AI-Powered Analysis',
          description: 'Our AI processes your documents using OCR and creates searchable text.',
          tips: [
            'Processing time varies by document size',
            'Scanned documents are converted to searchable text',
            'Document structure is preserved'
          ]
        },
        {
          title: '4. Ask Questions',
          description: 'Type questions about your documents and get instant AI-powered answers.',
          tips: [
            'Ask specific questions like "What is the notice period mentioned?"',
            'Request summaries: "Summarize the key terms of this contract"',
            'Find clauses: "What does the document say about termination?"',
            'AI citations show which part of the document the answer comes from'
          ]
        },
        {
          title: '5. Chat History',
          description: 'All your questions and answers are saved for future reference.',
          tips: [
            'Access previous conversations anytime',
            'Export chat history for your records',
            'Share insights with your lawyer if connected'
          ]
        }
      ]
    },
    {
      id: 'profile',
      title: 'Profile Management',
      icon: 'settings',
      steps: [
        {
          title: '1. Access Your Profile',
          description: 'Click on your avatar in the header and select "Profile".',
          tips: ['Keep your profile updated for better connections']
        },
        {
          title: '2. Upload Profile Picture',
          description: 'Hover over your profile picture and click the camera icon to upload a custom image.',
          tips: [
            'Use a professional photo',
            'Supported formats: JPG, PNG, GIF',
            'Maximum size: 5MB',
            'Click the delete icon to remove custom pictures'
          ]
        },
        {
          title: '3. Update Personal Information',
          description: 'Edit your name, email, phone number, and bio.',
          tips: [
            'A complete profile builds trust',
            'Add a professional bio if you\'re a lawyer',
            'Verify your email for full access'
          ]
        },
        {
          title: '4. Lawyer-Specific Settings',
          description: 'Lawyers can set specialties, fees, consultation modes, and practice details.',
          tips: [
            'Add multiple specialties for better visibility',
            'Set competitive consultation fees',
            'Specify available consultation modes (video, chat, in-person)',
            'Upload verification documents for faster approval'
          ]
        },
        {
          title: '5. Privacy & Security',
          description: 'Manage your password, email preferences, and account security.',
          tips: [
            'Use a strong password',
            'Enable email notifications for important updates',
            'Review connected accounts regularly'
          ]
        }
      ]
    },
    {
      id: 'lawyer-requests',
      title: 'Managing Client Requests (Lawyers)',
      icon: 'bell',
      steps: [
        {
          title: '1. Access Requests',
          description: 'Navigate to "Requests" from the home page or sidebar.',
          tips: ['New requests show a notification badge']
        },
        {
          title: '2. Review Client Requests',
          description: 'See all incoming connection requests with client details and their message.',
          tips: [
            'Read the client\'s message carefully',
            'Check their legal need and case type',
            'Review if it matches your specialty'
          ]
        },
        {
          title: '3. Accept or Reject',
          description: 'Click "Accept" to connect or "Reject" if the case is outside your expertise.',
          tips: [
            'Accepting creates a direct chat channel',
            'Consider your current workload',
            'You can add notes before accepting'
          ]
        },
        {
          title: '4. Start Engagement',
          description: 'Once accepted, the client is added to "My Clients" and you can start chatting.',
          tips: [
            'Send a welcome message promptly',
            'Discuss consultation fees and schedule',
            'Share necessary forms or documents'
          ]
        }
      ]
    },
    {
      id: 'guest-access',
      title: 'Guest Access Feature',
      icon: 'user',
      steps: [
        {
          title: '1. Try Without Signing Up',
          description: 'Use "Try as Guest" on the landing page to explore features without creating an account.',
          tips: ['Guest sessions last 24 hours']
        },
        {
          title: '2. Limited Features',
          description: 'Guests can try AutoFill Forms, Legal Desk, and Quick Guide.',
          tips: [
            'Cannot connect with lawyers as a guest',
            'Cannot save data permanently',
            'Chat history is temporary'
          ]
        },
        {
          title: '3. Convert to Full Account',
          description: 'Click "Sign Up" anytime to convert your guest session to a full account.',
          tips: [
            'Guest data can be migrated to your account',
            'Get full access to all features',
            'Connect with lawyers and save your work'
          ]
        }
      ]
    }
  ];

  const faqs = [
    {
      id: 1,
      question: 'Is my data secure on LegalSahai?',
      answer: 'Absolutely! We use industry-standard encryption for all data transmission and storage. Messages are encrypted end-to-end, and documents are stored in secure Google Cloud Storage with restricted access. We comply with data protection regulations and never share your information with third parties without consent.'
    },
    {
      id: 2,
      question: 'How much does it cost to use LegalSahai?',
      answer: 'Creating an account and browsing lawyers is completely free. You only pay consultation fees directly to lawyers based on their rates. The AutoFill Forms, Legal Desk, and Quick Guide features are free to use. There are no hidden charges or platform fees.'
    },
    {
      id: 3,
      question: 'How do I know if a lawyer is verified?',
      answer: 'Verified lawyers have a blue checkmark badge on their profiles. Our admin team manually reviews all lawyer applications, checking credentials, bar council registration, and professional documents. Only verified lawyers can accept client connections. You can view verification status on each lawyer\'s profile.'
    },
    {
      id: 4,
      question: 'Can I use the app without creating an account?',
      answer: 'Yes! You can try the app as a guest to explore AutoFill Forms, Legal Desk, and Quick Guide. However, guest access is limited and temporary (24 hours). To connect with lawyers, save your work permanently, and access all features, you\'ll need to create a free account.'
    },
    {
      id: 5,
      question: 'How does the AutoFill Forms feature work?',
      answer: 'Upload any PDF form and our AI automatically detects fillable fields. You can then type directly into the form, upload images (like signatures or photos), and download the completed PDF. The AI uses computer vision to identify text fields, checkboxes, and signature areas. Your data is saved securely so you can return later to complete partially filled forms.'
    },
    {
      id: 6,
      question: 'What is Legal Desk and how is it different from chat?',
      answer: 'Legal Desk is a document analysis tool where you upload legal documents (contracts, agreements, notices) and ask questions about them. Our AI reads the documents and provides answers with citations. Chat, on the other hand, is for real-time communication with lawyers. Legal Desk is great for understanding documents before consulting a lawyer.'
    },
    {
      id: 7,
      question: 'How do I become a verified lawyer on the platform?',
      answer: 'Navigate to Profile, select "Lawyer" role, and complete the onboarding form with your credentials, specialties, and experience. Upload your bar council certificate and valid ID. Our admin team reviews applications within 24-48 hours. You\'ll receive an email notification once approved. Rejected applications include feedback for resubmission.'
    },
    {
      id: 8,
      question: 'Can I cancel a connection request?',
      answer: 'Connection requests cannot be cancelled once sent, but lawyers can choose to accept or reject them. If you sent a request by mistake, you can message the lawyer through chat (once accepted) to clarify. If a lawyer rejects your request, you\'ll be notified and can send a new request to other lawyers.'
    },
    {
      id: 9,
      question: 'How do I download filled forms?',
      answer: 'In the AutoFill Forms page, after filling all required fields, click the "Download PDF" button. The system generates a new PDF with all your entered data and uploaded images. The downloaded file maintains the original form format and is ready for submission or printing.'
    },
    {
      id: 10,
      question: 'What file formats are supported?',
      answer: 'AutoFill Forms: PDF only. Legal Desk: PDF, DOC, DOCX, JPG, PNG. Chat attachments: PDF, DOC, DOCX, JPG, PNG, GIF. Profile pictures: JPG, PNG, GIF. Maximum file sizes vary by feature (5MB for profile pictures, 10MB for chat, 20MB for Legal Desk).'
    },
    {
      id: 11,
      question: 'How do I know if my message was delivered?',
      answer: 'Messages show a checkmark when delivered to the server. You\'ll see typing indicators when the other person is typing. Messages are stored even if the recipient is offline, and they\'ll receive them when they next log in. All messages are synced across devices in real-time.'
    },
    {
      id: 12,
      question: 'Can I access LegalSahai on mobile?',
      answer: 'Yes! LegalSahai is fully responsive and works seamlessly on mobile browsers. Simply visit the website from your mobile device. We\'re also working on native mobile apps for iOS and Android, coming soon. All features including chat, forms, and document upload work perfectly on mobile.'
    }
  ];

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    
    if (!contactForm.subject.trim() || !contactForm.message.trim()) {
      toast.error('Please fill in both subject and message');
      return;
    }

    if (!authUser?.email) {
      toast.error('Please log in to send a support message');
      return;
    }

    setSubmitting(true);

    try {
      await api.post('/api/support/create', {
        subject: contactForm.subject,
        message: contactForm.message
      });

      toast.success('Message sent successfully! Our team will get back to you soon.');
      setContactForm({ subject: '', message: '' });
    } catch (error) {
      console.error('Error sending support message:', error);
      toast.error('Failed to send message. Please try again or email us directly.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Support Center
          </h1>
          <p className="text-gray-600 text-lg">
            Everything you need to know about using LegalSahai
          </p>
        </motion.div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-3 mb-8 justify-center">
          <button
            onClick={() => setActiveSection('features')}
            className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
              activeSection === 'features'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            How to Use Features
          </button>
          <button
            onClick={() => setActiveSection('faq')}
            className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
              activeSection === 'faq'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            FAQs
          </button>
          <button
            onClick={() => setActiveSection('contact')}
            className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
              activeSection === 'contact'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Contact Us
          </button>
        </div>

        {/* Features Section */}
        {activeSection === 'features' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            {features.map((feature) => (
              <div
                key={feature.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
              >
                <button
                  onClick={() => setExpandedFeature(expandedFeature === feature.id ? null : feature.id)}
                  className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      {getFeatureIcon(feature.icon)}
                    </div>
                    <h3 className="text-xl font-semibold text-left">{feature.title}</h3>
                  </div>
                  <svg
                    className={`w-6 h-6 text-gray-400 transition-transform ${
                      expandedFeature === feature.id ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {expandedFeature === feature.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="px-6 pb-6"
                  >
                    <div className="space-y-6">
                      {feature.steps.map((step, idx) => (
                        <div key={idx} className="border-l-4 border-blue-500 pl-4">
                          <h4 className="font-semibold text-lg text-gray-900 mb-2">{step.title}</h4>
                          <p className="text-gray-700 mb-3">{step.description}</p>
                          {step.tips && step.tips.length > 0 && (
                            <div className="bg-blue-50 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <svg className="w-4 h-4 text-blue-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                </svg>
                                <p className="font-medium text-sm text-blue-900">Pro Tips:</p>
                              </div>
                              <ul className="space-y-1 text-sm text-blue-800">
                                {step.tips.map((tip, tipIdx) => (
                                  <li key={tipIdx}>• {tip}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>
            ))}
          </motion.div>
        )}

        {/* FAQ Section */}
        {activeSection === 'faq' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            {faqs.map((faq) => (
              <div
                key={faq.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
              >
                <button
                  onClick={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}
                  className="w-full p-5 flex items-start justify-between hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex-1 pr-4">
                    <h3 className="text-lg font-semibold text-gray-900">{faq.question}</h3>
                  </div>
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 mt-1 ${
                      expandedFaq === faq.id ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {expandedFaq === faq.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="px-5 pb-5"
                  >
                    <p className="text-gray-700 leading-relaxed">{faq.answer}</p>
                  </motion.div>
                )}
              </div>
            ))}
          </motion.div>
        )}

        {/* Contact Section */}
        {activeSection === 'contact' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-3xl mx-auto"
          >
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
              <h2 className="text-2xl font-bold mb-4">Still Need Help?</h2>
              <p className="text-gray-600 mb-6">
                If you couldn't find the answer you were looking for, don't worry! Our support team is here to help.
              </p>

              {/* Email Contact */}
              <div className="bg-blue-50 rounded-lg p-4 mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-blue-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <h3 className="font-semibold text-blue-900">Email Us</h3>
                </div>
                <p className="text-blue-800 text-sm mb-2">
                  Send us an email at:{' '}
                  <a href="mailto:legalsahai@gmail.com" className="font-medium underline hover:text-blue-600">
                    legalsahai@gmail.com
                  </a>
                </p>
                <p className="text-blue-700 text-xs">We typically respond within 24 hours</p>
              </div>

              {/* Message Form */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <h3 className="font-semibold text-lg">Send Us a Message</h3>
                </div>
                <form onSubmit={handleContactSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Subject <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={contactForm.subject}
                      onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                      placeholder="Brief description of your issue"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Message <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={contactForm.message}
                      onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                      placeholder="Describe your issue in detail..."
                      rows={6}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      required
                    />
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">
                      <strong>Note:</strong> Your message will be sent directly to our admin team. They will have access to your account details to better assist you with your issue.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Sending...' : 'Send Message'}
                  </button>
                </form>
              </div>

              {/* Contact Info */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                <h3 className="font-semibold mb-3">Other Ways to Reach Us</h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>• Check our FAQs above for quick answers</p>
                  <p>• Browse the feature guides for step-by-step instructions</p>
                  <p>• Your message history is saved and tracked by our team</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Support;
