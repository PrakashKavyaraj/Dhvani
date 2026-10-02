"""
Multi-Lingual Indic & English Social Engineering Scam Intent Detector for Dhvani.

Detects advanced voice fraud patterns common in India:
1. Digital Arrest & Law Enforcement Impersonation (CBI, ED, Police, Customs, TRAI)
2. Financial Phishing & Fake KYC Suspension (OTP, UPI PIN, Bank Block)
3. Family Emergency & Virtual Kidnapping Extortion (Child in custody, Hospital accident)
4. Malicious Remote Access (AnyDesk, TeamViewer, RustDesk, APK download)
5. Coercive Urgency & Forced Secrecy (Call mat kaatna, Abhi ke abhi, Don't disconnect)

Supports English, Hindi (Devanagari), and Hinglish (Phonetic Romanized Hindi).
"""

import re
from typing import Any, Dict, List, Set, Tuple


class IndicScamDetector:
    """
    Enterprise Social Engineering & Intent Analyzer specialized for Indian banking scams.
    """

    # 1. Digital Arrest & Law Enforcement Impersonation
    AUTHORITY_PATTERNS = [
        # English
        r"\b(digital arrest|cbi|police|customs|trai|narcotics|ncb|enforcement directorate|ed raid)\b",
        r"\b(arrest warrant|court order|money laundering|fir registered|case filed|non[- ]bailable warrant|cyber crime cell)\b",
        r"\b(illegal package|parcel seized|drugs found|customs clearance|court hearing|judicial custody)\b",
        # Hinglish
        r"\b(giraftar|giraftari|thana|police station|hiraasat|daroga|adhikari|kanooni karwayi)\b",
        r"\b(supreme court ka aadesh|case darj|jail bhejenge|parcel me drugs|nasha mila hai|chalan katega)\b",
        # Devanagari
        r"(डिजिटल अरेस्ट|सीबीआई|पुलिस|कस्टम्स|गिरफ्तार|गिरफ्तारी|थाना|वारंट|सुप्रीम कोर्ट|नारकोटिक्स|हिरासत|एफआईआर)",
    ]

    # 2. Financial Phishing & KYC Fraud
    FINANCIAL_PATTERNS = [
        # English
        r"\b(otp|one[- ]time password|upi pin|atm pin|cvv|credit card|debit card|bank account blocked)\b",
        r"\b(kyc expired|kyc update|kyc suspended|aadhaar link|pan link|sim block|electricity bill disconnection)\b",
        r"\b(wire transfer|beneficiary|refund claim|lottery prize|cashback offer|remote access)\b",
        # Hinglish
        r"\b(khata band|khata block|paise katenge|turant kyc|otp batao|otp dijiye|pin dalo|pin batao)\b",
        r"\b(qr code scan|inami rashi|paise bhejo|paisa wapas|bijli cut|bijli connection)\b",
        # Devanagari
        r"(ओटीपी|खाता ब्लॉक|खाता बंद|केवाईसी|पिन|क्यूआर कोड|आधार लिंक|पैन लिंक|पैसे भेजो)",
    ]

    # 3. Family Emergency / Virtual Kidnapping
    FAMILY_EXTORTION_PATTERNS = [
        # English
        r"\b(accident|hospitalized|icu|hostage|kidnapped|bail money|emergency ransom|critical condition)\b",
        # Hinglish
        r"\b(aapka beta|aapki beti|aapke bache|accident ho gaya|hospital me admit|police ne pakda)\b",
        r"\b(jail se chhudana|bachane ke liye paise|turant ilaj|kisi ko mat batana|police ko mat bulana)\b",
        # Devanagari
        r"(आपका बेटा|आपकी बेटी|एक्सीडेंट|अस्पताल|आईसीयू|किडनैप|बंधक|किसी को मत बताना)",
    ]

    # 4. Remote Device Access & APK Droppers
    REMOTE_ACCESS_PATTERNS = [
        # English
        r"\b(anydesk|teamviewer|rustdesk|quicksupport|screen share|apk file|install app|download link)\b",
        # Hinglish
        r"\b(app install karo|link bheja hai|screen share karo|code batao|mobile control)\b",
        # Devanagari
        r"(स्क्रीन शेयर|ऐप डाउनलोड|लिंक भेजो|कोड बताओ)",
    ]

    # 5. Coercive Urgency & Forced Secrecy
    URGENCY_PRESSURE_PATTERNS = [
        # English
        r"\b(emergency|immediately|urgent|right now|jail|prosecution|action required|suspended)\b",
        r"\b(don't disconnect|stay on line|strictly confidential|within 15 minutes|immediate action|last warning)\b",
        # Hinglish
        r"\b(turant|abhi ke abhi|call mat kaatna|phone mat rakhna|kisi se baat mat karna|aakhri mauka|aakhri chetavni)\b",
        # Devanagari
        r"(तुरंत|अभी के अभी|कॉल मत काटना|फोन मत रखना|किसी को मत बताना|आखिरी चेतावनी)",
    ]

    def __init__(self):
        # Compile master regexes with IGNORECASE and UNICODE support
        self._authority_regex = re.compile("|".join(self.AUTHORITY_PATTERNS), re.IGNORECASE | re.UNICODE)
        self._financial_regex = re.compile("|".join(self.FINANCIAL_PATTERNS), re.IGNORECASE | re.UNICODE)
        self._family_regex = re.compile("|".join(self.FAMILY_EXTORTION_PATTERNS), re.IGNORECASE | re.UNICODE)
        self._remote_regex = re.compile("|".join(self.REMOTE_ACCESS_PATTERNS), re.IGNORECASE | re.UNICODE)
        self._urgency_regex = re.compile("|".join(self.URGENCY_PRESSURE_PATTERNS), re.IGNORECASE | re.UNICODE)

    def scan(self, transcript: str) -> Tuple[float, List[str], Dict[str, Any]]:
        """
        Scans transcript text across all scam categories and computes a calibrated intent threat score.

        Returns:
            Tuple of:
            - intent_score: float in [0.0, 100.0]
            - forensic_reasons: list of explainable evidence strings
            - metadata: dictionary containing matched categories and detected scam archetype
        """
        if not transcript or not transcript.strip():
            return 0.0, [], {"archetype": "BENIGN", "matched_categories": []}

        clean_text = transcript.strip()

        # Find matches across all categories
        authority_matches = self._extract_matches(self._authority_regex, clean_text)
        financial_matches = self._extract_matches(self._financial_regex, clean_text)
        family_matches = self._extract_matches(self._family_regex, clean_text)
        remote_matches = self._extract_matches(self._remote_regex, clean_text)
        urgency_matches = self._extract_matches(self._urgency_regex, clean_text)

        matched_categories = []
        if authority_matches:
            matched_categories.append("LAW_ENFORCEMENT_AUTHORITY")
        if financial_matches:
            matched_categories.append("FINANCIAL_EXTRACTION")
        if family_matches:
            matched_categories.append("FAMILY_EXTORTION")
        if remote_matches:
            matched_categories.append("REMOTE_DEVICE_ACCESS")
        if urgency_matches:
            matched_categories.append("COERCIVE_PRESSURE")

        reasons: List[str] = []
        archetype = "BENIGN"
        intent_score = 0.0

        # High-risk correlated scam archetypes
        has_auth = len(authority_matches) > 0
        has_fin = len(financial_matches) > 0
        has_urg = len(urgency_matches) > 0
        has_fam = len(family_matches) > 0
        has_rem = len(remote_matches) > 0

        # Archetype 1: Digital Arrest Extortion (Authority + Financial Phishing / Coercion)
        if has_auth and (has_fin or has_urg):
            archetype = "DIGITAL_ARREST_EXTORTION"
            intent_score = 100.0 if (has_auth and has_fin and has_urg) else 90.0
            reasons.append(
                f"Critical social engineering pattern (Digital Arrest): Law enforcement impersonation ({', '.join(sorted(authority_matches))}) "
                f"correlated with {'financial extraction (' + ', '.join(sorted(financial_matches)) + ')' if has_fin else 'coercive urgency' }."
            )

        # Archetype 2: Virtual Kidnapping / Family Distress Fraud
        elif has_fam and (has_fin or has_urg):
            archetype = "FAMILY_DISTRESS_EXTORTION"
            intent_score = 95.0
            reasons.append(
                f"Critical Virtual Kidnapping scam pattern: Family distress coercion ({', '.join(sorted(family_matches))}) "
                f"paired with immediate financial ransom/transfer demands."
            )

        # Archetype 3: Remote Access Malware Dropper
        elif has_rem and (has_fin or has_urg):
            archetype = "REMOTE_DEVICE_HIJACK"
            intent_score = 85.0
            reasons.append(
                f"Malicious remote access pattern: Remote control tool ({', '.join(sorted(remote_matches))}) "
                f"paired with credential extraction prompts."
            )

        # Individual categories
        elif has_fin and has_urg:
            archetype = "FINANCIAL_PHISHING"
            intent_score = 85.0
            reasons.append(
                f"Financial extraction keywords identified with high pressure: "
                f"({', '.join(sorted(financial_matches))}) under urgency ({', '.join(sorted(urgency_matches))})."
            )

        elif has_fin:
            archetype = "FINANCIAL_PROMPT"
            intent_score = 70.0
            reasons.append(f"Financial transaction keywords identified: ({', '.join(sorted(financial_matches))}).")

        elif has_auth:
            archetype = "AUTHORITY_PROMPT"
            intent_score = 65.0
            reasons.append(f"Authority / Law enforcement keywords identified: ({', '.join(sorted(authority_matches))}).")

        elif has_urg:
            archetype = "URGENCY_PROMPT"
            intent_score = 45.0
            reasons.append(f"Elevated urgency keywords identified: ({', '.join(sorted(urgency_matches))}).")

        metadata = {
            "archetype": archetype,
            "matched_categories": matched_categories,
            "detected_keywords": {
                "authority": sorted(authority_matches),
                "financial": sorted(financial_matches),
                "family": sorted(family_matches),
                "remote_access": sorted(remote_matches),
                "urgency": sorted(urgency_matches),
            },
        }

        return intent_score, reasons, metadata

    @staticmethod
    def _extract_matches(regex: re.Pattern, text: str) -> Set[str]:
        """Extracts non-empty matching words/phrases."""
        matches = set()
        for match in regex.finditer(text):
            val = match.group(0).strip().lower()
            if val:
                matches.add(val)
        return matches


# Global singleton instance
indic_scam_detector = IndicScamDetector()
