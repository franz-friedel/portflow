import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Booking, BookingStatus, User, ServiceType, ChargeItem, ChatMessage } from './types';
import { GoogleGenAI, Type } from "@google/genai";

// Mock Data & Utilities
const MOCK_USER: User = { email: 'franz@portflow.org', companyName: 'PortFlow Global' };

const INITIAL_BOOKINGS: Booking[] = [
  {
    id: '1',
    referenceNumber: 'QRL-2024-0001',
    customerRef: 'PO-99212',
    dateSubmitted: '2024-03-20T10:30:00Z',
    customerName: 'TechCorp Solutions',
    contactPerson: 'Sarah Jenkins',
    customerEmail: 'shipping@techcorp.com',
    customerPhone: '+1 (555) 123-4567',
    origin: 'Singapore (SGSIN)',
    destination: 'Hamburg (DEHAM)',
    serviceType: 'Sea',
    direction: 'Export',
    incoterm: 'FOB',
    vesselName: 'MAERSK SEOUL',
    voyageNumber: '412W',
    isUrgent: true,
    status: 'New',
    weight: '2500 kg',
    dimensions: '2x 20GP',
    commodity: 'Electronics - High Density Servers',
    consignee: 'EuroDistribution GmbH',
    charges: [
      { code: 'OF', description: 'OCEAN FREIGHT', qty: 2, uom: 'CTR', unitPrice: 1850.00, currency: 'USD', total: 3700.00 },
      { code: 'ADM', description: 'ADMIN FEES', qty: 1, uom: 'SET', unitPrice: 50.00, currency: 'SGD', total: 50.00 }
    ],
    timeline: [{ status: 'New', date: '2024-03-20T10:30:00Z', note: 'Booking request received via portal.' }]
  }
];

const generateRef = () => `QRL-2024-${Math.floor(1000 + Math.random() * 9000)}`;

const ShipLogo = ({ className = "w-8 h-8" }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M50 15V35M28 42V32C28 29.8 29.8 28 32 28H68C70.2 28 72 29.8 72 32V42" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M22 65L32 82H68L78 65C78 58 70 52 50 52C30 52 22 58 22 65Z" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M15 82C15 78 22 75 30 75C38 75 42 80 50 80C58 80 62 75 70 75C78 75 85 78 85 82" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M50 40L58 50L50 60L42 50L50 40Z" fill="currentColor"/>
  </svg>
);

// --- Sub-Components ---

const LandingPage: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, isSubmitting]);

  useEffect(() => {
    if (messages.length === 0) {
      setTimeout(() => {
        setMessages([{
          role: 'assistant',
          content: "Hi! I'm your PortFlow assistant. I can help you build a shipping quote or track a booking. Where are you shipping from today?"
        }]);
      }, 500);
    }
  }, []);

  const submitToBackend = async (data: any) => {
    console.log('Final Submission Data:', data);
    
    // Explicitly using the production webhook as requested
    const response = await fetch('https://franzportflow.app.n8n.cloud/webhook/portflow-enquiry', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Submission failed with status ${response.status}: ${errorText}`);
    }
    
    return await response.json();
  };

  const extractAndSubmit = async (fullHistory: ChatMessage[]) => {
    setIsSubmitting(true);
    // Visual feedback in the chat UI
    setMessages(prev => [...prev, { role: 'assistant', content: "🔄 Submitting your enquiry..." }]);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const conversationText = fullHistory.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
      
      const extractionResponse = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [{ text: `Extract all shipping information from the conversation history below into a clean JSON object.
          
REQUIRED FIELDS (DO NOT LEAVE EMPTY IF MENTIONED):
1. customer_name: The person's name.
2. company_name: The customer's company.
3. email: Contact email address.
4. phone: Contact phone number.
5. origin_port: Departure location.
6. destination_port: Arrival location.
7. shipment_mode: Transport type (Sea/Air/Road).
8. container_type: e.g., 20ft, 40ft, LCL, etc.
9. commodity: Description of goods.
10. gross_weight: The weight value.
11. weight_unit: kg, lb, etc.
12. pieces_quantity: Number of packages or containers.
13. shipper_name: Party providing the goods.
14. shipper_address: Shipper's location.
15. consignee_name: Party receiving the goods.
16. consignee_address: Consignee's location.
17. preferred_date: Requested shipping date.
18. incoterm: e.g., FOB, CIF, EXW.

CONVERSATION HISTORY:
${conversationText}` }]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              customer_name: { type: Type.STRING },
              company_name: { type: Type.STRING },
              email: { type: Type.STRING },
              phone: { type: Type.STRING },
              origin_port: { type: Type.STRING },
              destination_port: { type: Type.STRING },
              shipment_mode: { type: Type.STRING },
              container_type: { type: Type.STRING },
              commodity: { type: Type.STRING },
              gross_weight: { type: Type.STRING },
              weight_unit: { type: Type.STRING },
              pieces_quantity: { type: Type.STRING },
              shipper_name: { type: Type.STRING },
              shipper_address: { type: Type.STRING },
              consignee_name: { type: Type.STRING },
              consignee_address: { type: Type.STRING },
              preferred_date: { type: Type.STRING },
              incoterm: { type: Type.STRING }
            }
          }
        }
      });

      const extractedData = JSON.parse(extractionResponse.text || '{}');
      
      // Ensure we explicitly map the data structure requested
      const data = {
        customer_name: extractedData.customer_name || "",
        company_name: extractedData.company_name || "",
        email: extractedData.email || "",
        phone: extractedData.phone || "",
        origin_port: extractedData.origin_port || "",
        destination_port: extractedData.destination_port || "",
        shipment_mode: extractedData.shipment_mode || "",
        container_type: extractedData.container_type || "",
        commodity: extractedData.commodity || "",
        gross_weight: extractedData.gross_weight || "",
        weight_unit: extractedData.weight_unit || "",
        pieces_quantity: extractedData.pieces_quantity || "",
        shipper_name: extractedData.shipper_name || "",
        shipper_address: extractedData.shipper_address || "",
        consignee_name: extractedData.consignee_name || "",
        consignee_address: extractedData.consignee_address || "",
        preferred_date: extractedData.preferred_date || "",
        incoterm: extractedData.incoterm || ""
      };

      const result = await submitToBackend(data);
      
      const quoteNumber = result.quote_number || result.id || Math.random().toString(36).substr(2, 6).toUpperCase();

      setMessages(prev => [
        ...prev.filter(m => m.content !== "🔄 Submitting your enquiry..."),
        { role: 'assistant', content: `✅ Enquiry submitted! Reference: ${quoteNumber}` }
      ]);
    } catch (err) {
      console.error('Submission failed:', err);
      setMessages(prev => [
        ...prev.filter(m => m.content !== "🔄 Submitting your enquiry..."),
        { role: 'assistant', content: "❌ Submission failed. Please try again." }
      ]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChat = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const userMsg = input.trim();
    if (!userMsg) return;

    setInput('');
    const newHistory: ChatMessage[] = [...messages, { role: 'user', content: userMsg }];
    setMessages(newHistory);

    // CASE-INSENSITIVE TRIGGER
    if (userMsg.toUpperCase() === 'CONFIRM') {
      await extractAndSubmit(newHistory);
      return;
    }
    
    setIsTyping(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [{ text: `You are PortFlow Assistant, a freight forwarding expert.
          
Your task is to gather all the following details from the customer to create a quote enquiry:
1. Customer Contact (Name, Email, Phone, Company)
2. Lane Info (Origin Port, Destination Port)
3. Cargo Details (Mode, Container Type, Commodity, Weight, Unit, Pieces)
4. Party Info (Shipper/Consignee Names & Addresses)
5. Logistics (Incoterm, Preferred Date)

Behavior:
- Ask for missing details one at a time.
- Be conversational and professional.
- Once most details are provided, provide a summary and ask for confirmation.
- MUST append the exact phrase "READY FOR OPS" at the very end of your response when the user is presented with a summary and needs to type "CONFIRM".

CONVERSATION HISTORY:
${messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}
USER: ${userMsg}` }]
        },
      });

      const aiText = response.text || "I'm sorry, I'm having trouble processing your request.";
      setMessages(prev => [...prev, { role: 'assistant', content: aiText }]);
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [...prev, { role: 'assistant', content: "Connection error. Please try again." }]);
    } finally {
      setIsTyping(false);
      if (inputRef.current) inputRef.current.focus();
    }
  };

  return (
    <div className="min-h-screen flex flex-col selection:bg-navy selection:text-white bg-[#fafbfd]">
      <header className="py-6 px-4 sm:px-8 max-w-7xl mx-auto w-full flex justify-between items-center bg-white/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center space-x-4 cursor-pointer group" onClick={() => onNavigate('landing')}>
          <div className="w-10 h-10 bg-white border border-slate-100 rounded-xl flex items-center justify-center transform group-hover:scale-110 transition-transform shadow-lg shadow-navy/5 overflow-hidden text-navy">
             <ShipLogo />
          </div>
          <span className="text-2xl font-black tracking-tighter text-navy">PortFlow</span>
        </div>
        <div className="flex items-center space-x-6">
          <button onClick={() => onNavigate('login')} className="text-sm font-bold text-navy hover:text-navy/70 uppercase tracking-widest transition-colors">Forwarder Login</button>
          <button onClick={() => onNavigate('login')} className="px-6 py-2.5 bg-navy text-white rounded-xl font-bold text-sm shadow-lg shadow-navy/10 hover:-translate-y-0.5 transition-all">Go to Ops Center</button>
        </div>
      </header>

      <main className="flex-grow">
        <section className="py-12 sm:py-20 px-4">
          <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="space-y-8">
              <h1 className="text-5xl sm:text-7xl font-extrabold text-navy leading-[1.05] tracking-tight">
                Conversational <br/> <span className="text-slate-400">Freight Booking.</span>
              </h1>
              <p className="text-xl text-slate-500 leading-relaxed max-w-lg">
                Automate your quoting workflow. PortFlow's AI extracts every jobsheet detail through a natural conversation, eliminating manual data entry.
              </p>
            </div>

            <div className="relative">
              <div className="absolute -inset-2 bg-navy rounded-[3.5rem] blur-xl opacity-5"></div>
              <div className="relative bg-white rounded-[3rem] shadow-2xl border border-slate-100 flex flex-col h-[650px] overflow-hidden">
                <div className="p-6 bg-navy text-white flex items-center justify-between shadow-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-sm font-black tracking-widest uppercase">Booking Assistant</span>
                  </div>
                  <div className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-bold uppercase tracking-wider">
                    v3.0 Production
                  </div>
                </div>

                <div className="flex-grow overflow-y-auto p-6 space-y-6 bg-slate-50/20">
                  {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                        <div className={`p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${
                          msg.role === 'user' 
                            ? 'bg-navy text-white rounded-tr-none' 
                            : 'bg-white border border-slate-100 text-slate-700 rounded-tl-none font-medium'
                        }`}>
                          <div className="whitespace-pre-wrap">{msg.content.replace('READY FOR OPS', '').trim()}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {isTyping && (
                    <div className="flex justify-start">
                      <div className="bg-white border border-slate-100 p-4 rounded-2xl flex space-x-2 items-center">
                        <div className="w-1.5 h-1.5 bg-navy/30 rounded-full animate-bounce"></div>
                        <div className="w-1.5 h-1.5 bg-navy/30 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                        <div className="w-1.5 h-1.5 bg-navy/30 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div className="p-4 bg-white border-t border-slate-100">
                  <form onSubmit={handleChat} className="relative">
                    <input 
                      ref={inputRef}
                      type="text" 
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={isSubmitting ? "Submitting..." : "Type info or CONFIRM..."}
                      disabled={isSubmitting}
                      className="w-full p-4 pr-16 rounded-2xl border-2 border-slate-100 focus:border-navy focus:ring-4 focus:ring-navy/5 outline-none font-medium transition-all text-sm placeholder:text-slate-300 disabled:opacity-50"
                    />
                    <button 
                      type="submit" 
                      disabled={!input.trim() || isTyping || isSubmitting}
                      className="absolute right-2.5 top-2.5 p-2.5 bg-navy text-white rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-navy/10 disabled:opacity-30"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-12 border-t border-slate-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-4">
             <div className="w-8 h-8 bg-navy/5 rounded-lg flex items-center justify-center text-navy">
                <ShipLogo className="w-5 h-5" />
             </div>
             <span className="text-xl font-black text-navy tracking-tighter">PortFlow</span>
          </div>
          <div className="flex space-x-10 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
            <a href="#" className="hover:text-navy transition-colors">Documentation</a>
            <a href="#" className="hover:text-navy transition-colors">Pricing</a>
            <a href="#" className="hover:text-navy transition-colors">Privacy</a>
            <a href="mailto:franz@portflow.org" className="hover:text-navy transition-colors">Contact Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

const Dashboard: React.FC<{ user: User; onLogout: () => void; onNavigate: (path: string) => void }> = ({ user, onLogout, onNavigate }) => {
  const [bookings, setBookings] = useState<Booking[]>(() => {
    const saved = localStorage.getItem('portflow_bookings');
    return saved ? JSON.parse(saved) : INITIAL_BOOKINGS;
  });
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('portflow_bookings', JSON.stringify(bookings));
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    return bookings.filter(b => 
      b.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
      b.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [bookings, searchTerm]);

  const handleExportJSON = () => {
    if (!selectedBooking) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(selectedBooking, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${selectedBooking.referenceNumber}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleFinalize = () => {
    if (!selectedBooking) return;
    const updatedBookings = bookings.map(b => 
      b.id === selectedBooking.id ? { ...b, status: 'Booked' as BookingStatus } : b
    );
    setBookings(updatedBookings);
    setSelectedBooking(null);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsScanModalOpen(true);

    try {
      const base64Data = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve((e.target?.result as string).split(',')[1]);
        reader.readAsDataURL(file);
      });

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: {
          parts: [
            { inlineData: { data: base64Data, mimeType: file.type || 'image/jpeg' } },
            { text: "Extract freight data into JSON schema including direction, shipper, consignee, route, and charges." }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              direction: { type: Type.STRING },
              shipment_type: { type: Type.STRING },
              shipper_name: { type: Type.STRING },
              shipper_address: { type: Type.STRING },
              consignee_name: { type: Type.STRING },
              consignee_address: { type: Type.STRING },
              origin_port: { type: Type.STRING },
              destination_port: { type: Type.STRING },
              gross_weight: { type: Type.NUMBER },
              commodity: { type: Type.STRING },
              freight_charges: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    charge_code: { type: Type.STRING },
                    charge_description: { type: Type.STRING },
                    quantity: { type: Type.NUMBER },
                    unit_price: { type: Type.NUMBER },
                    currency: { type: Type.STRING }
                  }
                }
              }
            }
          }
        }
      });

      const data = JSON.parse(response.text || '{}');
      
      const newBooking: Booking = {
        id: Math.random().toString(36).substr(2, 9),
        referenceNumber: generateRef(),
        dateSubmitted: new Date().toISOString(),
        customerName: data.shipper_name || 'New Customer',
        shipperAddress: data.shipper_address,
        contactPerson: 'Vision Extract',
        customerEmail: 'pending@extracted.com',
        customerPhone: 'N/A',
        origin: data.origin_port || 'TBD',
        destination: data.destination_port || 'TBD',
        serviceType: (data.shipment_type?.includes('Air') ? 'Air' : 'Sea') as ServiceType,
        direction: data.direction as any,
        weight: `${data.gross_weight || 0} kg`,
        grossWeight: data.gross_weight,
        commodity: data.commodity || 'General Cargo',
        consignee: data.consignee_name || 'TBD',
        consigneeAddress: data.consignee_address,
        isUrgent: false,
        status: 'New',
        dimensions: 'Extracted',
        charges: (data.freight_charges || []).map((c: any) => ({
          code: c.charge_code || 'MISC',
          description: c.charge_description || 'Miscellaneous',
          qty: c.quantity || 1,
          uom: 'UNT',
          unitPrice: c.unit_price || 0,
          currency: c.currency || 'USD',
          total: (c.quantity || 1) * (c.unit_price || 0)
        })),
        timeline: [{ status: 'New', date: new Date().toISOString(), note: 'AI Extraction complete.' }]
      };

      setBookings(prev => [newBooking, ...prev]);
      setSelectedBooking(newBooking);
      setIsScanModalOpen(false);
    } catch (err) {
      console.error(err);
      alert("AI Scan failed.");
      setIsScanModalOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center sticky top-0 z-20 shadow-sm">
        <div className="flex items-center space-x-8">
          <span className="text-xl font-black text-navy cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-2" onClick={() => onNavigate('landing')}>
            <ShipLogo className="w-6 h-6" /> PortFlow
          </span>
          <nav className="flex space-x-6">
            <button 
              className="text-sm font-bold text-navy border-b-2 border-navy pb-1 cursor-default"
            >
              Operations
            </button>
            <button 
              onClick={() => onNavigate('landing')}
              className="text-sm font-bold text-slate-400 hover:text-navy transition-colors pb-1"
            >
              Portals
            </button>
          </nav>
        </div>
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-2 px-5 py-2.5 bg-navy text-white rounded-xl font-bold text-sm hover:bg-navy-dark shadow-xl shadow-navy/20 transition-all hover:-translate-y-0.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            <span>Scan Doc</span>
          </button>
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*,application/pdf" />
          <p className="text-sm font-bold text-navy hidden sm:block">{user.companyName}</p>
          <button onClick={onLogout} className="text-xs font-bold text-red-500 uppercase tracking-widest hover:text-red-700 transition-colors">Logout</button>
        </div>
      </header>

      <main className="flex-grow p-8 max-w-7xl mx-auto w-full">
        <div className="flex justify-between items-end mb-8">
          <h1 className="text-4xl font-black text-navy tracking-tight">Ops Center</h1>
          <input 
            type="text" 
            placeholder="Filter bookings..."
            className="px-5 py-3 rounded-xl border border-slate-200 outline-none focus:border-navy shadow-sm w-80 bg-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                <th className="px-8 py-5">Date</th>
                <th className="px-8 py-5">Ref #</th>
                <th className="px-8 py-5">Partner</th>
                <th className="px-8 py-5">Lane</th>
                <th className="px-8 py-5">Status</th>
                <th className="px-8 py-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredBookings.map(booking => (
                <tr key={booking.id} className="hover:bg-slate-50/50 transition-colors cursor-pointer group" onClick={() => setSelectedBooking(booking)}>
                  <td className="px-8 py-5 text-sm font-bold text-slate-500">{new Date(booking.dateSubmitted).toLocaleDateString()}</td>
                  <td className="px-8 py-5 text-sm font-black text-navy">{booking.referenceNumber}</td>
                  <td className="px-8 py-5">
                    <p className="text-sm font-black text-slate-800">{booking.customerName}</p>
                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">{booking.serviceType}</p>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-bold text-navy">{booking.origin.split(' (')[0]}</span>
                      <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                      <span className="text-sm font-bold text-navy">{booking.destination.split(' (')[0]}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                      booking.status === 'Booked' 
                        ? 'bg-green-50 text-green-600 border-green-100' 
                        : 'bg-blue-50 text-blue-600 border-blue-100'
                    }`}>
                      {booking.status}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button className="text-xs font-black text-navy bg-navy/5 px-4 py-2 rounded-xl opacity-0 group-hover:opacity-100 transition-all uppercase tracking-widest">Detail View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredBookings.length === 0 && (
            <div className="p-32 text-center text-slate-300 font-black uppercase tracking-[0.3em]">No jobsheets found</div>
          )}
        </div>
      </main>

      {/* LOADING SCANNER */}
      {isScanModalOpen && (
        <div className="fixed inset-0 bg-navy/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] p-12 max-w-sm w-full text-center shadow-2xl animate-in zoom-in duration-300">
            <div className="relative w-24 h-24 mx-auto mb-8">
              <div className="absolute inset-0 border-4 border-slate-50 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-navy border-t-transparent rounded-full animate-spin"></div>
            </div>
            <h3 className="text-3xl font-black text-navy mb-3">AI Analysis</h3>
            <p className="text-slate-500 font-bold leading-relaxed">Processing jobsheet data...</p>
          </div>
        </div>
      )}

      {/* DETAILED MODAL */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-navy/40 backdrop-blur-sm z-50 flex justify-end">
          <div className="bg-white w-full max-w-4xl h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 overflow-hidden">
            <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
              <div>
                <h2 className="text-3xl font-black text-navy">Jobsheet Detailed</h2>
                <div className="flex items-center space-x-3 mt-1">
                  <span className="text-sm font-bold text-slate-400 tracking-[0.2em] uppercase">{selectedBooking.referenceNumber}</span>
                </div>
              </div>
              <button onClick={() => setSelectedBooking(null)} className="p-3 hover:bg-slate-100 rounded-2xl transition-all text-slate-400">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-grow overflow-y-auto p-10 space-y-12">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="col-span-2 bg-slate-50 p-6 rounded-3xl border border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Origin</p>
                    <p className="font-black text-navy text-lg">{selectedBooking.origin}</p>
                  </div>
                  <svg className="w-8 h-8 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Destination</p>
                    <p className="font-black text-navy text-lg">{selectedBooking.destination}</p>
                  </div>
                </div>
                <div className="p-4 bg-white border rounded-2xl">
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Direction</p>
                  <p className="font-bold text-navy uppercase">{selectedBooking.direction || 'N/A'}</p>
                </div>
                <div className="p-4 bg-white border rounded-2xl">
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Incoterm</p>
                  <p className="font-bold text-navy uppercase">{selectedBooking.incoterm || 'FOB'}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Shipper Details</label>
                  <p className="font-black text-navy">{selectedBooking.customerName}</p>
                  <p className="text-sm text-slate-500 mt-2 leading-relaxed italic">{selectedBooking.shipperAddress || 'Full address details not yet mapped.'}</p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Consignee Details</label>
                  <p className="font-black text-navy">{selectedBooking.consignee}</p>
                  <p className="text-sm text-slate-500 mt-2 leading-relaxed italic">{selectedBooking.consigneeAddress || 'Full address details not yet mapped.'}</p>
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-[10px] font-black text-navy uppercase tracking-[0.3em] border-l-4 border-navy pl-3">Charges Breakdown</h3>
                <div className="overflow-hidden rounded-3xl border border-slate-100 shadow-sm">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Code</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Description</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase text-center">Qty</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase text-right">Price</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {(selectedBooking.charges || []).map((charge, i) => (
                        <tr key={i}>
                          <td className="px-6 py-4 font-black text-navy">{charge.code}</td>
                          <td className="px-6 py-4 text-slate-600 font-bold">{charge.description}</td>
                          <td className="px-6 py-4 text-center font-bold">{charge.qty}</td>
                          <td className="px-6 py-4 text-right text-slate-500">{charge.currency} {charge.unitPrice.toFixed(2)}</td>
                          <td className="px-6 py-4 text-right font-black text-navy">{charge.currency} {charge.total.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-10 border-t border-slate-100 flex space-x-6 bg-white sticky bottom-0">
              <button 
                onClick={handleExportJSON}
                className="flex-1 py-5 bg-slate-100 text-navy rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95"
              >
                Export JSON
              </button>
              <button 
                onClick={handleFinalize}
                className="flex-1 py-5 bg-navy text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-navy-dark transition-all shadow-xl shadow-navy/20 active:scale-95"
              >
                Finalize Jobsheet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const LoginPage: React.FC<{ onLogin: (user: User) => void; onNavigate: (path: string) => void }> = ({ onLogin, onNavigate }) => {
  const [email, setEmail] = useState('franz@portflow.org');
  const [company, setCompany] = useState('PortFlow Global');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin({ email, companyName: company });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white p-12 rounded-[2.5rem] shadow-2xl max-w-md w-full border border-slate-100">
        <div className="text-center mb-10">
          <span className="text-3xl font-black text-navy cursor-pointer flex items-center justify-center gap-2" onClick={() => onNavigate('landing')}>
            <ShipLogo className="w-8 h-8" /> PortFlow
          </span>
          <h2 className="text-xl font-bold text-slate-400 mt-4 uppercase tracking-widest">Forwarder Login</h2>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-2">Email Address</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-4 rounded-xl border border-slate-200 outline-none focus:border-navy font-medium text-navy"
              required
            />
          </div>
          <div>
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-2">Company Name</label>
            <input 
              type="text" 
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full p-4 rounded-xl border border-slate-200 outline-none focus:border-navy font-medium text-navy"
              required
            />
          </div>
          <button type="submit" className="w-full py-5 bg-navy text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-navy/20">
            Enter Dashboard
          </button>
        </form>
        <button onClick={() => onNavigate('landing')} className="w-full mt-6 text-xs font-bold text-slate-400 uppercase tracking-widest hover:text-navy">
          Back to Home
        </button>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [currentPath, setCurrentPath] = useState(() => window.location.hash.replace('#/', '') || 'landing');
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('portflow_session');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    const handleHashChange = () => setCurrentPath(window.location.hash.replace('#/', '') || 'landing');
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = (path: string) => {
    window.location.hash = `#/${path}`;
    setCurrentPath(path);
  };

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('portflow_session', JSON.stringify(user));
    navigate('dashboard');
  };

  const renderView = () => {
    if (currentPath === 'login') return <LoginPage onLogin={handleLogin} onNavigate={navigate} />;
    if (currentPath === 'dashboard') return currentUser ? <Dashboard user={currentUser} onLogout={() => { setCurrentUser(null); navigate('landing'); }} onNavigate={navigate} /> : <LoginPage onLogin={handleLogin} onNavigate={navigate} />;
    return <LandingPage onNavigate={navigate} />;
  };

  return <div className="font-sans antialiased text-slate-900">{renderView()}</div>;
};

export default App;