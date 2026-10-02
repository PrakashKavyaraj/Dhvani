import React from 'react';
import { ExpandableCard } from '@/components/ui/expandable-card';
import {
  Zap,
  PhoneCall,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  ArrowRight,
  Lock,
  Activity,
  Sparkles,
  PhoneOff,
  Radio,
} from 'lucide-react';

interface ForensicScenarioCardsProps {
  onSelectScenario: (scenarioId: string) => void;
}

export function ForensicScenarioCards({ onSelectScenario }: ForensicScenarioCardsProps) {
  const scenarios = [
    {
      id: 'scam_red',
      title: '₹50K Police Extortion Scam',
      description: 'Red Zone (88/100) • AI Voice Clone',
      image: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=80',
      badge: 'RED ZONE • HIGH RISK',
      badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      icon: Zap,
      transcript:
        '"Papa, my phone was snatched, I’m at the police station, please UPI ₹50,000 to this inspector right now, urgently!"',
      forensics: [
        {
          label: 'Layer 1 (Acoustic)',
          detail: '88.0% synthetic likelihood. Neural vocoder diffusion residuals and phase glitch detected via Forensics 0.3B & AASIST-L.',
        },
        {
          label: 'Layer 2 (Identity)',
          detail: 'ECAPA-TDNN cosine similarity of 0.54 departing sharply from registered family voiceprint baseline.',
        },
        {
          label: 'Layer 3 (Context)',
          detail: 'Digital arrest coercion keywords ("police station", "inspector", "urgently", "₹50,000 UPI") detected in real-time transcript.',
        },
      ],
      mitigations: 'Bank transfer paused • Cyber fraud desk alerted • Out-of-band push challenge dispatched',
    },
    {
      id: 'telephony_yellow',
      title: 'Ekart Cellular Telephony Call',
      description: 'Moderate Zone (48/100) • 2G Rural AMR',
      image: 'https://images.unsplash.com/photo-1534536281715-e28d76689b4d?auto=format&fit=crop&w=1200&q=80',
      badge: 'MODERATE ZONE • STEP-UP LIVENESS',
      badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      icon: PhoneCall,
      transcript:
        '"Bhaiya aapka parcel dispatch ho chuka hai, delivery address confirm kar dijiye, OTP ki koi zaroorat nahi hai."',
      forensics: [
        {
          label: 'Layer 1 (Acoustic)',
          detail: 'AASIST flags synthetic (98.1%) due to 3.4kHz telephony cutoff, but Forensics 0.3B detects organic vocal tract (10.2%). Sensor disagreement.',
        },
        {
          label: 'Layer 2 (Channel)',
          detail: 'AMR-NB 3.4kHz low-pass filter identified. Channel reliability weight dropped to 25% to prevent false alarm.',
        },
        {
          label: 'Layer 3 (Context)',
          detail: 'Zero extortion, urgency, or OTP coercion detected. Legitimate commercial delivery context.',
        },
      ],
      mitigations: 'Step-up liveness advisory • Account NOT blocked • Frictionless genuine customer experience',
    },
    {
      id: 'green_safe',
      title: 'Verified Citizen Speech',
      description: 'Green Zone (14/100) • Organic Voice',
      image: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80',
      badge: 'GREEN ZONE • VERIFIED SAFE',
      badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      icon: CheckCircle2,
      transcript:
        '"Namaste, main apne electricity bill ka status check karna chahta hoon jo pichle hafte bhara tha."',
      forensics: [
        {
          label: 'Layer 1 (Acoustic)',
          detail: 'Natural organic vocal tract harmonics. 4.1% spoof probability. Smooth continuous pitch contour (YIN F0).',
        },
        {
          label: 'Layer 2 (Identity)',
          detail: 'ECAPA-TDNN speaker verification confirmed with high confidence (92.8% cosine match).',
        },
        {
          label: 'Layer 3 (Context)',
          detail: 'Routine citizen utility query with zero coercive phrasing or anomalous pressure.',
        },
      ],
      mitigations: 'Stream Approved • Zero holds • Real-time processing completed in sub-second volatile RAM',
    },
  ];

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-200">
            Forensic Threat Intelligence Dossiers
          </h3>
        </div>
        <span className="text-[11px] font-mono text-slate-400">
          Click any dossier card to expand full forensic evidence & test live
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 justify-items-center">
        {scenarios.map((sc) => {
          const IconComp = sc.icon;
          return (
            <ExpandableCard
              key={sc.id}
              title={sc.title}
              description={sc.description}
              src={sc.image}
              className="w-full max-w-[320px] bg-[#090e1a] border-cyan-500/20 hover:border-cyan-400/50 hover:shadow-[0_0_25px_rgba(6,182,212,0.15)] transition-all"
              classNameExpanded="bg-[#070b14] border border-cyan-500/40 text-slate-200 [&_h4]:text-cyan-300 [&_h4]:font-semibold [&_h4]:text-sm [&_h4]:font-mono [&_h4]:mt-4"
            >
              {/* Expanded Card Body Content */}
              <div className="w-full space-y-4 text-left font-sans">
                {/* Status Badge */}
                <div className="flex items-center space-x-2">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold border ${sc.badgeClass}`}>
                    {sc.badge}
                  </span>
                </div>

                {/* Audio Transcript Box */}
                <div className="p-4 rounded-2xl bg-black/60 border border-white/10 space-y-1.5">
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                    Intercepted Audio Transcript:
                  </span>
                  <p className="text-sm italic text-slate-200 font-medium">
                    {sc.transcript}
                  </p>
                </div>

                {/* 3-Layer Evidence Breakdown */}
                <div className="space-y-2.5">
                  <h4 className="uppercase tracking-wider text-xs flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-cyan-400" />
                    Multi-Layer Forensic Telemetry
                  </h4>
                  {sc.forensics.map((f, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1 text-xs">
                      <span className="font-mono font-bold text-cyan-300 block text-[11px]">
                        {f.label}
                      </span>
                      <p className="text-slate-300 text-xs leading-relaxed">
                        {f.detail}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Autonomous Mitigations */}
                <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/20 text-xs space-y-1">
                  <span className="font-mono text-[10px] text-cyan-400 uppercase font-bold block">
                    Enterprise Countermeasure Action:
                  </span>
                  <p className="text-slate-200 font-medium">
                    {sc.mitigations}
                  </p>
                </div>

                {/* CTA Button to Load and Analyze in Live Dashboard */}
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectScenario(sc.id);
                    }}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-mono text-xs font-bold transition-all shadow-lg shadow-cyan-600/30 flex items-center space-x-2 cursor-pointer"
                  >
                    <span>Execute Voice Integrity Inspection</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </ExpandableCard>
          );
        })}
      </div>
    </div>
  );
}
