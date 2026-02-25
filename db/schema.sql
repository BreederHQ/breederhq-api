\restrict dbmate

-- Dumped from database version 17.8 (6108b59)
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: _monitoring; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA _monitoring;


--
-- Name: SCHEMA _monitoring; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA _monitoring IS 'Database monitoring: table growth tracking, performance diagnostics, cost signals';


--
-- Name: marketplace; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA marketplace;


--
-- Name: citext; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;


--
-- Name: EXTENSION citext; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION citext IS 'data type for case-insensitive character strings';


--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: vector; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;


--
-- Name: EXTENSION vector; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION vector IS 'vector data type and ivfflat and hnsw access methods';


--
-- Name: BreederVerificationTier; Type: TYPE; Schema: marketplace; Owner: -
--

CREATE TYPE marketplace."BreederVerificationTier" AS ENUM (
    'SUBSCRIBER',
    'MARKETPLACE_ENABLED',
    'IDENTITY_VERIFIED',
    'VERIFIED',
    'ACCREDITED'
);


--
-- Name: ServiceProviderVerificationTier; Type: TYPE; Schema: marketplace; Owner: -
--

CREATE TYPE marketplace."ServiceProviderVerificationTier" AS ENUM (
    'LISTED',
    'IDENTITY_VERIFIED',
    'VERIFIED_PROFESSIONAL',
    'ACCREDITED_PROVIDER'
);


--
-- Name: ServiceSourceType; Type: TYPE; Schema: marketplace; Owner: -
--

CREATE TYPE marketplace."ServiceSourceType" AS ENUM (
    'PROVIDER',
    'BREEDER'
);


--
-- Name: TwoFactorMethod; Type: TYPE; Schema: marketplace; Owner: -
--

CREATE TYPE marketplace."TwoFactorMethod" AS ENUM (
    'PASSKEY',
    'TOTP',
    'SMS'
);


--
-- Name: VerificationRequestStatus; Type: TYPE; Schema: marketplace; Owner: -
--

CREATE TYPE marketplace."VerificationRequestStatus" AS ENUM (
    'PENDING',
    'IN_REVIEW',
    'NEEDS_INFO',
    'APPROVED',
    'DENIED'
);


--
-- Name: ActivityCategory; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ActivityCategory" AS ENUM (
    'ENS',
    'ESI',
    'SOCIALIZATION',
    'HANDLING',
    'ENRICHMENT',
    'TRAINING',
    'HEALTH',
    'ASSESSMENT',
    'TRANSITION',
    'CUSTOM'
);


--
-- Name: ActivityFrequency; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ActivityFrequency" AS ENUM (
    'ONCE',
    'DAILY',
    'TWICE_DAILY',
    'WEEKLY',
    'AS_AVAILABLE',
    'CHECKLIST'
);


--
-- Name: ActivityLevel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ActivityLevel" AS ENUM (
    'VIGOROUS',
    'NORMAL',
    'WEAK',
    'LETHARGIC'
);


--
-- Name: AdministeredBy; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AdministeredBy" AS ENUM (
    'SELF',
    'VET',
    'VET_TECH'
);


--
-- Name: AnchorType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AnchorType" AS ENUM (
    'CYCLE_START',
    'OVULATION',
    'BREEDING_DATE',
    'BIRTH',
    'LOCKED_CYCLE'
);


--
-- Name: AnimalAccessSource; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AnimalAccessSource" AS ENUM (
    'INQUIRY',
    'QR_SCAN',
    'SHARE_CODE',
    'BREEDING_AGREEMENT'
);


--
-- Name: AnimalAccessStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AnimalAccessStatus" AS ENUM (
    'ACTIVE',
    'EXPIRED',
    'REVOKED',
    'OWNER_DELETED'
);


--
-- Name: AnimalAccessTier; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AnimalAccessTier" AS ENUM (
    'BASIC',
    'GENETICS',
    'LINEAGE',
    'HEALTH',
    'FULL'
);


--
-- Name: AnimalListingIntent; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AnimalListingIntent" AS ENUM (
    'STUD',
    'BROOD_PLACEMENT',
    'REHOME',
    'GUARDIAN',
    'TRAINED',
    'WORKING',
    'STARTED',
    'CO_OWNERSHIP'
);


--
-- Name: AnimalListingStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AnimalListingStatus" AS ENUM (
    'DRAFT',
    'LIVE',
    'PAUSED'
);


--
-- Name: AnimalStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AnimalStatus" AS ENUM (
    'ACTIVE',
    'BREEDING',
    'UNAVAILABLE',
    'RETIRED',
    'DECEASED',
    'PROSPECT'
);


--
-- Name: AssessmentType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AssessmentType" AS ENUM (
    'VOLHARD_PAT',
    'CUSTOM'
);


--
-- Name: AuditActorContext; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AuditActorContext" AS ENUM (
    'STAFF',
    'CLIENT',
    'PUBLIC'
);


--
-- Name: AuditOutcome; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AuditOutcome" AS ENUM (
    'SUCCESS',
    'FAILURE'
);


--
-- Name: AuditSurface; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AuditSurface" AS ENUM (
    'PLATFORM',
    'PORTAL',
    'MARKETPLACE'
);


--
-- Name: AutoReplyLogStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AutoReplyLogStatus" AS ENUM (
    'sent',
    'skipped',
    'failed'
);


--
-- Name: AutoReplyRuleStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AutoReplyRuleStatus" AS ENUM (
    'active',
    'paused',
    'archived'
);


--
-- Name: AutoReplyTriggerType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AutoReplyTriggerType" AS ENUM (
    'dm_first_message_from_party',
    'dm_after_hours',
    'email_received',
    'time_based',
    'keyword_match',
    'business_hours'
);


--
-- Name: BillingInterval; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."BillingInterval" AS ENUM (
    'MONTHLY',
    'YEARLY',
    'QUARTERLY'
);


--
-- Name: BoostStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."BoostStatus" AS ENUM (
    'PENDING',
    'ACTIVE',
    'PAUSED',
    'EXPIRED',
    'CANCELED'
);


--
-- Name: BoostTier; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."BoostTier" AS ENUM (
    'BOOST',
    'FEATURED'
);


--
-- Name: BreederReportReason; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."BreederReportReason" AS ENUM (
    'SPAM',
    'FRAUD',
    'HARASSMENT',
    'MISREPRESENTATION',
    'OTHER'
);


--
-- Name: BreederReportSeverity; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."BreederReportSeverity" AS ENUM (
    'LIGHT',
    'MEDIUM',
    'HEAVY'
);


--
-- Name: BreederReportStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."BreederReportStatus" AS ENUM (
    'PENDING',
    'REVIEWED',
    'DISMISSED',
    'ACTIONED'
);


--
-- Name: BreedingAgreementStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."BreedingAgreementStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'EXPIRED'
);


--
-- Name: BreedingBookingStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."BreedingBookingStatus" AS ENUM (
    'INQUIRY',
    'PENDING_REQUIREMENTS',
    'APPROVED',
    'DEPOSIT_PAID',
    'CONFIRMED',
    'SCHEDULED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED'
);


--
-- Name: BreedingBookingType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."BreedingBookingType" AS ENUM (
    'STUD_SERVICE',
    'LEASE_BREEDING',
    'CO_OWN',
    'AI_SHIPPED',
    'NATURAL_COVER'
);


--
-- Name: BreedingCycleAnchorEvent; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."BreedingCycleAnchorEvent" AS ENUM (
    'CYCLE_START',
    'BREED_DATE',
    'BIRTH_DATE',
    'WEANED_DATE'
);


--
-- Name: BreedingGroupMemberStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."BreedingGroupMemberStatus" AS ENUM (
    'EXPOSED',
    'REMOVED',
    'NOT_PREGNANT',
    'PREGNANT',
    'LAMBING_IMMINENT',
    'LAMBED',
    'FAILED'
);


--
-- Name: BreedingGroupStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."BreedingGroupStatus" AS ENUM (
    'ACTIVE',
    'EXPOSURE_COMPLETE',
    'MONITORING',
    'LAMBING',
    'COMPLETE',
    'CANCELED'
);


--
-- Name: BreedingGuaranteeType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."BreedingGuaranteeType" AS ENUM (
    'NO_GUARANTEE',
    'LIVE_FOAL',
    'STANDS_AND_NURSES',
    'SIXTY_DAY_PREGNANCY',
    'CERTIFIED_PREGNANT'
);


--
-- Name: BreedingInquiryStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."BreedingInquiryStatus" AS ENUM (
    'NEW',
    'READ',
    'REPLIED',
    'CONVERTED',
    'ARCHIVED',
    'SPAM'
);


--
-- Name: BreedingListingFeeDirection; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."BreedingListingFeeDirection" AS ENUM (
    'I_RECEIVE',
    'I_PAY',
    'SPLIT',
    'NEGOTIABLE'
);


--
-- Name: BreedingListingIntent; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."BreedingListingIntent" AS ENUM (
    'OFFERING',
    'SEEKING',
    'LEASE',
    'ARRANGEMENT'
);


--
-- Name: BreedingListingStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."BreedingListingStatus" AS ENUM (
    'DRAFT',
    'PUBLISHED',
    'PAUSED',
    'CLOSED'
);


--
-- Name: BreedingMethod; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."BreedingMethod" AS ENUM (
    'NATURAL',
    'AI_TCI',
    'AI_SI',
    'AI_FROZEN',
    'AI_VAGINAL',
    'AI_SURGICAL',
    'AI_LAPAROSCOPIC',
    'EMBRYO_TRANSFER'
);


--
-- Name: BreedingPlanBuyerStage; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."BreedingPlanBuyerStage" AS ENUM (
    'POSSIBLE_MATCH',
    'INQUIRY',
    'ASSIGNED',
    'MATCHED_TO_OFFSPRING',
    'DEPOSIT_NEEDED',
    'DEPOSIT_PAID',
    'AWAITING_PICK',
    'MATCH_PROPOSED',
    'COMPLETED',
    'DECLINED',
    'WITHDRAWN',
    'PENDING',
    'MATCHED',
    'OPTED_OUT',
    'VISIT_SCHEDULED',
    'PICKUP_SCHEDULED',
    'WINDOW_EXPIRED'
);


--
-- Name: BreedingPlanStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."BreedingPlanStatus" AS ENUM (
    'PLANNING',
    'COMMITTED',
    'CYCLE_EXPECTED',
    'HORMONE_TESTING',
    'BRED',
    'PREGNANT',
    'BIRTHED',
    'WEANED',
    'PLACEMENT',
    'COMPLETE',
    'CANCELED',
    'CYCLE',
    'UNSUCCESSFUL',
    'ON_HOLD',
    'PLAN_COMPLETE',
    'BORN',
    'DISSOLVED'
);


--
-- Name: BreedingProgramStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."BreedingProgramStatus" AS ENUM (
    'ACTIVE',
    'PAUSED',
    'ARCHIVED'
);


--
-- Name: BreedingRuleCategory; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."BreedingRuleCategory" AS ENUM (
    'LISTING',
    'PRICING',
    'VISIBILITY',
    'BUYER_INTERACTION',
    'STATUS',
    'NOTIFICATIONS'
);


--
-- Name: BreedingRuleLevel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."BreedingRuleLevel" AS ENUM (
    'PROGRAM',
    'PLAN',
    'GROUP',
    'OFFSPRING'
);


--
-- Name: BundleStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."BundleStatus" AS ENUM (
    'active',
    'archived'
);


--
-- Name: BuyerEmailTemplateCategory; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."BuyerEmailTemplateCategory" AS ENUM (
    'GENERAL',
    'INITIAL_CONTACT',
    'FOLLOW_UP',
    'VIEWING',
    'NEGOTIATION',
    'CLOSING'
);


--
-- Name: BuyerStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."BuyerStatus" AS ENUM (
    'LEAD',
    'ACTIVE',
    'QUALIFIED',
    'NEGOTIATING',
    'PURCHASED',
    'INACTIVE',
    'ARCHIVED'
);


--
-- Name: BuyerTaskPriority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."BuyerTaskPriority" AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'URGENT'
);


--
-- Name: BuyerTaskStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."BuyerTaskStatus" AS ENUM (
    'PENDING',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED',
    'DEFERRED'
);


--
-- Name: BuyerTaskType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."BuyerTaskType" AS ENUM (
    'FOLLOW_UP',
    'CALL',
    'EMAIL',
    'SCHEDULE_VIEWING',
    'SEND_INFO',
    'VET_CHECK',
    'CONTRACT',
    'PAYMENT',
    'OTHER'
);


--
-- Name: CampaignChannel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."CampaignChannel" AS ENUM (
    'email',
    'social',
    'ads',
    'marketplace',
    'website',
    'other'
);


--
-- Name: ChangeRequestStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ChangeRequestStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'CANCELLED'
);


--
-- Name: CommChannel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."CommChannel" AS ENUM (
    'EMAIL',
    'SMS',
    'PHONE',
    'MAIL',
    'WHATSAPP'
);


--
-- Name: CompetitionType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."CompetitionType" AS ENUM (
    'CONFORMATION_SHOW',
    'OBEDIENCE_TRIAL',
    'AGILITY_TRIAL',
    'FIELD_TRIAL',
    'HERDING_TRIAL',
    'TRACKING_TEST',
    'RALLY_TRIAL',
    'RACE',
    'PERFORMANCE_TEST',
    'BREED_SPECIALTY',
    'OTHER'
);


--
-- Name: ComplianceStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ComplianceStatus" AS ENUM (
    'SUBSCRIBED',
    'UNSUBSCRIBED'
);


--
-- Name: ConfidenceLevel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ConfidenceLevel" AS ENUM (
    'HIGH',
    'MEDIUM',
    'LOW'
);


--
-- Name: ContractStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ContractStatus" AS ENUM (
    'draft',
    'sent',
    'viewed',
    'signed',
    'declined',
    'voided',
    'expired'
);


--
-- Name: ContractTemplateCategory; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ContractTemplateCategory" AS ENUM (
    'SALES_AGREEMENT',
    'DEPOSIT_AGREEMENT',
    'CO_OWNERSHIP',
    'GUARDIAN_HOME',
    'STUD_SERVICE',
    'HEALTH_GUARANTEE',
    'CUSTOM'
);


--
-- Name: ContractTemplateType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ContractTemplateType" AS ENUM (
    'SYSTEM',
    'CUSTOM'
);


--
-- Name: DHIATestType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."DHIATestType" AS ENUM (
    'STANDARD',
    'OWNER_SAMPLER',
    'HERD_TEST'
);


--
-- Name: DataSource; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."DataSource" AS ENUM (
    'OBSERVED',
    'DERIVED',
    'ESTIMATED'
);


--
-- Name: DealActivityType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."DealActivityType" AS ENUM (
    'CALL',
    'EMAIL',
    'MEETING',
    'VIEWING',
    'NOTE',
    'STATUS_CHANGE',
    'OFFER_MADE',
    'OFFER_RECEIVED',
    'CONTRACT_SENT',
    'CONTRACT_SIGNED'
);


--
-- Name: DealOutcome; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."DealOutcome" AS ENUM (
    'WON',
    'LOST',
    'CANCELLED'
);


--
-- Name: DealStage; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."DealStage" AS ENUM (
    'INQUIRY',
    'VIEWING',
    'NEGOTIATION',
    'VET_CHECK',
    'CONTRACT',
    'CLOSED_WON',
    'CLOSED_LOST'
);


--
-- Name: DocStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."DocStatus" AS ENUM (
    'PLACEHOLDER',
    'UPLOADING',
    'READY',
    'FAILED'
);


--
-- Name: DocVisibility; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."DocVisibility" AS ENUM (
    'PRIVATE',
    'BUYERS',
    'PUBLIC'
);


--
-- Name: DocumentKind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."DocumentKind" AS ENUM (
    'generic',
    'health_certificate',
    'registration',
    'contract_pdf',
    'invoice_pdf',
    'photo',
    'other',
    'bill_of_sale',
    'syndication_agreement',
    'lease_agreement',
    'insurance_policy',
    'vet_certificate'
);


--
-- Name: DocumentScope; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."DocumentScope" AS ENUM (
    'group',
    'offspring',
    'invoice',
    'contract',
    'animal',
    'contact'
);


--
-- Name: DraftChannel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."DraftChannel" AS ENUM (
    'email',
    'dm'
);


--
-- Name: EmailChangeStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."EmailChangeStatus" AS ENUM (
    'PENDING_VERIFICATION',
    'VERIFIED',
    'EXPIRED',
    'CANCELLED'
);


--
-- Name: EmailSendCategory; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."EmailSendCategory" AS ENUM (
    'transactional',
    'marketing'
);


--
-- Name: EmailSendStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."EmailSendStatus" AS ENUM (
    'queued',
    'sent',
    'failed',
    'delivered',
    'bounced',
    'complained',
    'deferred'
);


--
-- Name: EntitlementKey; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."EntitlementKey" AS ENUM (
    'MARKETPLACE_ACCESS',
    'PLATFORM_ACCESS',
    'PORTAL_ACCESS',
    'BREEDING_PLANS',
    'FINANCIAL_SUITE',
    'DOCUMENT_MANAGEMENT',
    'HEALTH_RECORDS',
    'WAITLIST_MANAGEMENT',
    'ADVANCED_REPORTING',
    'API_ACCESS',
    'MULTI_LOCATION',
    'E_SIGNATURES',
    'ANIMAL_QUOTA',
    'CONTACT_QUOTA',
    'PORTAL_USER_QUOTA',
    'BREEDING_PLAN_QUOTA',
    'MARKETPLACE_LISTING_QUOTA',
    'STORAGE_QUOTA_GB',
    'SMS_QUOTA',
    'DATA_EXPORT',
    'GENETICS_STANDARD',
    'GENETICS_PRO',
    'AI_ASSISTANT'
);


--
-- Name: EntitlementStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."EntitlementStatus" AS ENUM (
    'ACTIVE',
    'REVOKED'
);


--
-- Name: EsignProvider; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."EsignProvider" AS ENUM (
    'DOCUSIGN',
    'HELLOSIGN',
    'ADOBE',
    'OTHER'
);


--
-- Name: EsignStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."EsignStatus" AS ENUM (
    'DRAFT',
    'SENT',
    'VIEWED',
    'SIGNED',
    'DECLINED',
    'EXPIRED',
    'VOIDED'
);


--
-- Name: ExpenseCategory; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ExpenseCategory" AS ENUM (
    'VET',
    'SUPPLIES',
    'FOOD',
    'GROOMING',
    'BREEDING',
    'FACILITY',
    'MARKETING',
    'LABOR',
    'INSURANCE',
    'REGISTRATION',
    'TRAVEL',
    'OTHER'
);


--
-- Name: FeatureModule; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."FeatureModule" AS ENUM (
    'GENETICS',
    'MARKETPLACE',
    'FINANCIAL',
    'ANIMALS',
    'CONTACTS',
    'BREEDING',
    'DOCUMENTS',
    'HEALTH',
    'SCHEDULING',
    'PORTAL',
    'REPORTING',
    'SETTINGS',
    'DASHBOARD'
);


--
-- Name: FiberLabTestType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."FiberLabTestType" AS ENUM (
    'MICRON_ANALYSIS',
    'YIELD_TEST',
    'STAPLE_STRENGTH',
    'FULL_PROFILE'
);


--
-- Name: FinanceScope; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."FinanceScope" AS ENUM (
    'group',
    'offspring',
    'contact',
    'organization',
    'general',
    'waitlist'
);


--
-- Name: FleeceGrade; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."FleeceGrade" AS ENUM (
    'PRIME',
    'CHOICE',
    'STANDARD',
    'UTILITY',
    'REJECT'
);


--
-- Name: FoalHealthStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."FoalHealthStatus" AS ENUM (
    'HEALTHY',
    'MINOR_ISSUES',
    'VETERINARY_CARE',
    'CRITICAL',
    'DECEASED'
);


--
-- Name: FoalNursingStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."FoalNursingStatus" AS ENUM (
    'UNKNOWN',
    'NURSING_WELL',
    'ASSISTED',
    'BOTTLE_FED',
    'ORPHANED'
);


--
-- Name: FoodChangeReason; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."FoodChangeReason" AS ENUM (
    'LIFE_STAGE',
    'HEALTH_ISSUE',
    'VET_RECOMMENDATION',
    'AVAILABILITY',
    'COST_OPTIMIZATION',
    'PERFORMANCE',
    'PREFERENCE',
    'OTHER'
);


--
-- Name: FoodType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."FoodType" AS ENUM (
    'DRY',
    'WET',
    'RAW',
    'FRESH',
    'FREEZE_DRIED',
    'SUPPLEMENT',
    'TREAT',
    'OTHER'
);


--
-- Name: GeneticSnoozeType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."GeneticSnoozeType" AS ENUM (
    'ANIMAL',
    'TEST',
    'ANIMAL_TEST'
);


--
-- Name: GuaranteeResolution; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."GuaranteeResolution" AS ENUM (
    'NOT_TRIGGERED',
    'RETURN_BREEDING_GRANTED',
    'PARTIAL_REFUND',
    'FULL_REFUND',
    'WAIVED'
);


--
-- Name: HealthType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."HealthType" AS ENUM (
    'weight',
    'vaccine',
    'deworm',
    'vet_visit',
    'treatment',
    'other'
);


--
-- Name: HorseIntendedUse; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."HorseIntendedUse" AS ENUM (
    'BREEDING',
    'SHOW',
    'RACING'
);


--
-- Name: HorseValuationSource; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."HorseValuationSource" AS ENUM (
    'PRIVATE_SALE',
    'AUCTION',
    'APPRAISAL',
    'INSURANCE',
    'OTHER'
);


--
-- Name: IdentifierType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."IdentifierType" AS ENUM (
    'MICROCHIP',
    'AKC',
    'UKC',
    'CKC',
    'KC',
    'FCI',
    'AQHA',
    'JOCKEY_CLUB',
    'USEF',
    'ADGA',
    'AGS',
    'ARBA',
    'TICA',
    'CFA',
    'EMBARK',
    'WISDOM_PANEL',
    'DNA_PROFILE',
    'TATTOO',
    'EAR_TAG',
    'USDA_SCRAPIE',
    'OTHER'
);


--
-- Name: InquiryPermission; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."InquiryPermission" AS ENUM (
    'ANYONE',
    'VERIFIED',
    'CONNECTIONS'
);


--
-- Name: InquiryStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."InquiryStatus" AS ENUM (
    'NEW',
    'CONTACTED',
    'QUALIFIED',
    'SCHEDULED_VISIT',
    'CONVERTED',
    'NOT_INTERESTED',
    'SPAM'
);


--
-- Name: InterestLevel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."InterestLevel" AS ENUM (
    'BROWSING',
    'INTERESTED',
    'SERIOUS',
    'OFFERED',
    'DECLINED'
);


--
-- Name: InterventionResponse; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."InterventionResponse" AS ENUM (
    'IMPROVED',
    'NO_CHANGE',
    'WORSENED'
);


--
-- Name: InterventionRoute; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."InterventionRoute" AS ENUM (
    'ORAL',
    'SUBCUTANEOUS',
    'INTRAVENOUS',
    'INTRAMUSCULAR',
    'TOPICAL',
    'INHALATION'
);


--
-- Name: InvoiceCategory; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."InvoiceCategory" AS ENUM (
    'DEPOSIT',
    'SERVICE',
    'GOODS',
    'MIXED',
    'OTHER'
);


--
-- Name: InvoiceRole; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."InvoiceRole" AS ENUM (
    'RESERVATION',
    'DEPOSIT',
    'FINAL',
    'MISC'
);


--
-- Name: InvoiceStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."InvoiceStatus" AS ENUM (
    'draft',
    'issued',
    'partially_paid',
    'paid',
    'void',
    'uncollectible',
    'refunded',
    'cancelled'
);


--
-- Name: LactationStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."LactationStatus" AS ENUM (
    'FRESH',
    'MILKING',
    'DRY',
    'PREGNANT_DRY',
    'TRANSITION'
);


--
-- Name: LifeStage; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."LifeStage" AS ENUM (
    'PUPPY',
    'JUNIOR',
    'ADULT',
    'SENIOR',
    'ALL_STAGES',
    'BREEDING',
    'PERFORMANCE'
);


--
-- Name: LineItemKind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."LineItemKind" AS ENUM (
    'DEPOSIT',
    'SERVICE_FEE',
    'GOODS',
    'DISCOUNT',
    'TAX',
    'OTHER'
);


--
-- Name: LinkMethod; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."LinkMethod" AS ENUM (
    'GAID',
    'EXCHANGE_CODE',
    'REGISTRY_MATCH',
    'MICROCHIP_MATCH',
    'BREEDER_REQUEST',
    'OFFSPRING_DERIVED'
);


--
-- Name: LinkRequestStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."LinkRequestStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'DENIED',
    'EXPIRED',
    'REVOKED'
);


--
-- Name: ListingBoostTarget; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ListingBoostTarget" AS ENUM (
    'INDIVIDUAL_ANIMAL',
    'ANIMAL_PROGRAM',
    'BREEDING_PROGRAM',
    'BREEDER',
    'BREEDER_SERVICE',
    'BREEDING_LISTING',
    'PROVIDER_SERVICE'
);


--
-- Name: ListingStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ListingStatus" AS ENUM (
    'DRAFT',
    'PENDING_REVIEW',
    'ACTIVE',
    'PAUSED',
    'EXPIRED',
    'REMOVED'
);


--
-- Name: ListingTier; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ListingTier" AS ENUM (
    'FREE',
    'PREMIUM',
    'BUSINESS'
);


--
-- Name: ListingType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ListingType" AS ENUM (
    'BREEDING_PROGRAM',
    'STUD_SERVICE',
    'TRAINING',
    'VETERINARY',
    'PHOTOGRAPHY',
    'GROOMING',
    'TRANSPORT',
    'BOARDING',
    'PRODUCT',
    'OTHER_SERVICE'
);


--
-- Name: MarePostFoalingCondition; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."MarePostFoalingCondition" AS ENUM (
    'EXCELLENT',
    'GOOD',
    'FAIR',
    'POOR',
    'VETERINARY_CARE_REQUIRED'
);


--
-- Name: MarketplaceBlockLevel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."MarketplaceBlockLevel" AS ENUM (
    'LIGHT',
    'MEDIUM',
    'HEAVY'
);


--
-- Name: MarketplaceListingStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."MarketplaceListingStatus" AS ENUM (
    'DRAFT',
    'LIVE',
    'PAUSED'
);


--
-- Name: MediaAccessActor; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."MediaAccessActor" AS ENUM (
    'OWNER',
    'BUYER',
    'PUBLIC',
    'PORTAL'
);


--
-- Name: MediaAccessType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."MediaAccessType" AS ENUM (
    'VIEW',
    'DOWNLOAD',
    'SHARE'
);


--
-- Name: MembershipRole; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."MembershipRole" AS ENUM (
    'OWNER',
    'ADMIN',
    'MEMBER',
    'VIEWER'
);


--
-- Name: MicrochipRenewalType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."MicrochipRenewalType" AS ENUM (
    'LIFETIME',
    'ANNUAL',
    'UNKNOWN'
);


--
-- Name: MilestoneType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."MilestoneType" AS ENUM (
    'VET_PREGNANCY_CHECK_15D',
    'VET_ULTRASOUND_45D',
    'VET_ULTRASOUND_90D',
    'BEGIN_MONITORING_300D',
    'PREPARE_FOALING_AREA_320D',
    'DAILY_CHECKS_330D',
    'DUE_DATE_340D',
    'OVERDUE_VET_CALL_350D',
    'UDDER_DEVELOPMENT',
    'UDDER_FULL',
    'WAX_APPEARANCE',
    'VULVAR_RELAXATION',
    'TAILHEAD_RELAXATION',
    'MILK_CALCIUM_TEST',
    'PREGNANCY_CONFIRMATION',
    'ULTRASOUND_HEARTBEAT',
    'ULTRASOUND_COUNT',
    'XRAY_COUNT',
    'BEGIN_MONITORING',
    'DAILY_CHECKS',
    'PREPARE_BIRTH_AREA',
    'DUE_DATE',
    'OVERDUE_VET_CALL',
    'TEMPERATURE_DROP',
    'NESTING_BEHAVIOR',
    'LOSS_OF_APPETITE',
    'RESTLESSNESS',
    'VULVAR_CHANGES',
    'MILK_PRESENT',
    'LIGAMENT_SOFTENING',
    'UDDER_TIGHT',
    'FUR_PULLING',
    'NEST_BUILDING'
);


--
-- Name: MilkingFrequency; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."MilkingFrequency" AS ENUM (
    'ONCE_DAILY',
    'TWICE_DAILY',
    'THREE_DAILY'
);


--
-- Name: NeonatalFeedingMethod; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."NeonatalFeedingMethod" AS ENUM (
    'NURSING',
    'SUPPLEMENTAL',
    'BOTTLE',
    'TUBE',
    'ORPHANED'
);


--
-- Name: NeonatalHealthStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."NeonatalHealthStatus" AS ENUM (
    'THRIVING',
    'WATCH',
    'CRITICAL',
    'DECEASED'
);


--
-- Name: NeonatalInterventionType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."NeonatalInterventionType" AS ENUM (
    'PLASMA_TRANSFUSION',
    'COLOSTRUM_SUPPLEMENT',
    'SERUM_IMMUNOGLOBULIN',
    'SUBQ_FLUIDS',
    'IV_FLUIDS',
    'DEXTROSE_GLUCOSE',
    'TUBE_FEEDING',
    'IRON_SUPPLEMENT',
    'CALCIUM_SUPPLEMENT',
    'OXYGEN_THERAPY',
    'DOXAPRAM',
    'NALOXONE',
    'NEBULIZER',
    'ANTIBIOTIC',
    'PROBIOTIC',
    'DEWORMER',
    'VITAMIN_K',
    'UMBILICAL_CARE',
    'EYE_CARE',
    'SKIN_TREATMENT',
    'OTHER'
);


--
-- Name: NetworkInquiryStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."NetworkInquiryStatus" AS ENUM (
    'PENDING',
    'RESPONDED',
    'DECLINED'
);


--
-- Name: NetworkVisibility; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."NetworkVisibility" AS ENUM (
    'VISIBLE',
    'ANONYMOUS',
    'HIDDEN'
);


--
-- Name: NotificationPriority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."NotificationPriority" AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'URGENT'
);


--
-- Name: NotificationStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."NotificationStatus" AS ENUM (
    'UNREAD',
    'READ',
    'DISMISSED'
);


--
-- Name: NotificationType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."NotificationType" AS ENUM (
    'vaccination_expiring_7d',
    'vaccination_expiring_3d',
    'vaccination_expiring_1d',
    'vaccination_overdue',
    'breeding_heat_cycle_expected',
    'breeding_hormone_testing_due',
    'breeding_window_approaching',
    'pregnancy_check_14d',
    'pregnancy_check_30d',
    'pregnancy_check_overdue',
    'foaling_30d',
    'foaling_14d',
    'foaling_7d',
    'foaling_approaching',
    'foaling_overdue',
    'marketplace_inquiry',
    'marketplace_waitlist_signup',
    'system_announcement',
    'foaling_270d',
    'foaling_300d',
    'foaling_320d',
    'foaling_330d',
    'contract_sent',
    'contract_reminder_7d',
    'contract_reminder_3d',
    'contract_reminder_1d',
    'contract_signed',
    'contract_declined',
    'contract_voided',
    'contract_expired',
    'guarantee_expiring_30d',
    'guarantee_expiring_7d',
    'guarantee_expired',
    'microchip_renewal_30d',
    'microchip_renewal_14d',
    'microchip_renewal_7d',
    'microchip_renewal_3d',
    'microchip_expired',
    'genetic_test_missing',
    'genetic_test_incomplete',
    'genetic_test_prebreeding',
    'genetic_test_carrier_warning',
    'genetic_test_registration',
    'genetic_test_recommended',
    'supplement_starting_7d',
    'supplement_starting_3d',
    'supplement_starting_1d',
    'supplement_due_today',
    'supplement_overdue',
    'supplement_schedule_complete',
    'network_breeding_inquiry',
    'network_inquiry_response',
    'breeding_data_agreement_request',
    'breeding_data_agreement_approved',
    'breeding_data_agreement_rejected'
);


--
-- Name: OffspringFinancialState; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."OffspringFinancialState" AS ENUM (
    'NONE',
    'DEPOSIT_PENDING',
    'DEPOSIT_PAID',
    'PAID_IN_FULL',
    'REFUNDED',
    'CHARGEBACK'
);


--
-- Name: OffspringKeeperIntent; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."OffspringKeeperIntent" AS ENUM (
    'AVAILABLE',
    'UNDER_EVALUATION',
    'WITHHELD',
    'KEEP'
);


--
-- Name: OffspringLifeState; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."OffspringLifeState" AS ENUM (
    'ALIVE',
    'DECEASED'
);


--
-- Name: OffspringPaperworkState; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."OffspringPaperworkState" AS ENUM (
    'NONE',
    'SENT',
    'SIGNED',
    'COMPLETE'
);


--
-- Name: OffspringPlacementState; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."OffspringPlacementState" AS ENUM (
    'UNASSIGNED',
    'OPTION_HOLD',
    'RESERVED',
    'PLACED',
    'RETURNED',
    'TRANSFERRED'
);


--
-- Name: OffspringStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."OffspringStatus" AS ENUM (
    'NEWBORN',
    'ALIVE',
    'WEANED',
    'PLACED',
    'DECEASED'
);


--
-- Name: OvulationMethod; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."OvulationMethod" AS ENUM (
    'CALCULATED',
    'PROGESTERONE_TEST',
    'LH_TEST',
    'ULTRASOUND',
    'VAGINAL_CYTOLOGY',
    'PALPATION',
    'AT_HOME_TEST',
    'VETERINARY_EXAM',
    'BREEDING_INDUCED'
);


--
-- Name: OwnerRole; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."OwnerRole" AS ENUM (
    'SOLE_OWNER',
    'CO_OWNER',
    'MANAGING_PARTNER',
    'SILENT_PARTNER',
    'BREEDING_RIGHTS',
    'INVESTOR'
);


--
-- Name: OwnershipChangeKind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."OwnershipChangeKind" AS ENUM (
    'SALE',
    'SYNDICATION',
    'TRANSFER',
    'LEASE',
    'DEATH',
    'OTHER'
);


--
-- Name: ParentType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ParentType" AS ENUM (
    'SIRE',
    'DAM'
);


--
-- Name: PartyActivityKind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PartyActivityKind" AS ENUM (
    'NOTE_ADDED',
    'NOTE_UPDATED',
    'EMAIL_SENT',
    'EVENT_CREATED',
    'EVENT_COMPLETED',
    'MILESTONE_OCCURRED',
    'STATUS_CHANGED',
    'TAG_ADDED',
    'TAG_REMOVED',
    'INVOICE_CREATED',
    'PAYMENT_RECEIVED',
    'MESSAGE_SENT',
    'MESSAGE_RECEIVED',
    'PROFILE_UPDATED_BY_CLIENT',
    'NAME_CHANGE_REQUESTED',
    'NAME_CHANGE_APPROVED',
    'NAME_CHANGE_REJECTED',
    'EMAIL_CHANGE_REQUESTED',
    'EMAIL_CHANGE_VERIFIED',
    'EMAIL_CHANGE_EXPIRED',
    'PORTAL_INVITE_AUTO_SENT',
    'PORTAL_ACCESS_GRANTED',
    'PORTAL_ACCESS_REVOKED',
    'NOTE_DELETED',
    'EVENT_UPDATED',
    'EVENT_DELETED',
    'MILESTONE_UPDATED',
    'MILESTONE_DELETED'
);


--
-- Name: PartyEventKind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PartyEventKind" AS ENUM (
    'FOLLOW_UP',
    'MEETING',
    'CALL',
    'VISIT',
    'CUSTOM'
);


--
-- Name: PartyEventStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PartyEventStatus" AS ENUM (
    'SCHEDULED',
    'COMPLETED',
    'CANCELLED'
);


--
-- Name: PartyMilestoneKind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PartyMilestoneKind" AS ENUM (
    'BIRTHDAY',
    'CUSTOMER_ANNIVERSARY',
    'PLACEMENT_ANNIVERSARY',
    'CUSTOM'
);


--
-- Name: PartyType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PartyType" AS ENUM (
    'CONTACT',
    'ORGANIZATION'
);


--
-- Name: PaymentIntentPurpose; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PaymentIntentPurpose" AS ENUM (
    'DEPOSIT',
    'PURCHASE',
    'STUD_FEE',
    'BOARDING',
    'TRAINING',
    'OTHER'
);


--
-- Name: PaymentIntentStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PaymentIntentStatus" AS ENUM (
    'PLANNED',
    'EXTERNAL',
    'COMPLETED',
    'CANCELED'
);


--
-- Name: PaymentStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PaymentStatus" AS ENUM (
    'pending',
    'succeeded',
    'failed',
    'refunded',
    'disputed',
    'cancelled'
);


--
-- Name: PortalAccessStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PortalAccessStatus" AS ENUM (
    'NO_ACCESS',
    'INVITED',
    'ACTIVE',
    'SUSPENDED'
);


--
-- Name: PreferenceLevel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PreferenceLevel" AS ENUM (
    'ALLOW',
    'NOT_PREFERRED',
    'NEVER'
);


--
-- Name: PregnancyCheckMethod; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PregnancyCheckMethod" AS ENUM (
    'PALPATION',
    'ULTRASOUND',
    'RELAXIN_TEST',
    'XRAY',
    'OTHER'
);


--
-- Name: ProductType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ProductType" AS ENUM (
    'SUBSCRIPTION',
    'ADD_ON',
    'ONE_TIME'
);


--
-- Name: RearingAssignmentStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."RearingAssignmentStatus" AS ENUM (
    'ACTIVE',
    'COMPLETED',
    'PAUSED',
    'CANCELLED'
);


--
-- Name: RearingCertificateType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."RearingCertificateType" AS ENUM (
    'BREEDER_PHASE',
    'BUYER_PHASE',
    'FULL_PROTOCOL'
);


--
-- Name: RearingCompletionScope; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."RearingCompletionScope" AS ENUM (
    'LITTER',
    'INDIVIDUAL'
);


--
-- Name: RearingExceptionType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."RearingExceptionType" AS ENUM (
    'SKIPPED',
    'DELAYED',
    'MODIFIED',
    'UNABLE_TO_COMPLETE'
);


--
-- Name: RegistryConnectionStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."RegistryConnectionStatus" AS ENUM (
    'DISCONNECTED',
    'CONNECTING',
    'CONNECTED',
    'ERROR',
    'TOKEN_EXPIRED'
);


--
-- Name: ReproAnchorMode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ReproAnchorMode" AS ENUM (
    'CYCLE_START',
    'OVULATION',
    'BREEDING_DATE'
);


--
-- Name: RevokedBy; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."RevokedBy" AS ENUM (
    'CHILD_OWNER',
    'PARENT_OWNER',
    'SYSTEM'
);


--
-- Name: SchedulingBookingStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SchedulingBookingStatus" AS ENUM (
    'CONFIRMED',
    'CANCELLED',
    'RESCHEDULED',
    'NO_SHOW'
);


--
-- Name: SchedulingEventStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SchedulingEventStatus" AS ENUM (
    'DRAFT',
    'OPEN',
    'CLOSED',
    'CANCELLED'
);


--
-- Name: SchedulingSlotMode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SchedulingSlotMode" AS ENUM (
    'IN_PERSON',
    'VIRTUAL'
);


--
-- Name: SchedulingSlotStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SchedulingSlotStatus" AS ENUM (
    'AVAILABLE',
    'FULL',
    'CANCELLED'
);


--
-- Name: SemenCollectionMethod; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SemenCollectionMethod" AS ENUM (
    'AV',
    'EE',
    'MANUAL'
);


--
-- Name: SemenInventoryStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SemenInventoryStatus" AS ENUM (
    'AVAILABLE',
    'RESERVED',
    'DEPLETED',
    'EXPIRED',
    'DISCARDED'
);


--
-- Name: SemenQualityGrade; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SemenQualityGrade" AS ENUM (
    'EXCELLENT',
    'GOOD',
    'FAIR',
    'POOR'
);


--
-- Name: SemenStorageType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SemenStorageType" AS ENUM (
    'FRESH',
    'COOLED',
    'FROZEN'
);


--
-- Name: SemenUsageType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SemenUsageType" AS ENUM (
    'BREEDING_ON_SITE',
    'BREEDING_SHIPPED',
    'TRANSFERRED',
    'SAMPLE_TESTING',
    'DISCARDED'
);


--
-- Name: Sex; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Sex" AS ENUM (
    'FEMALE',
    'MALE',
    'UNKNOWN'
);


--
-- Name: ShareCodeStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ShareCodeStatus" AS ENUM (
    'ACTIVE',
    'EXPIRED',
    'REVOKED',
    'MAX_USES_REACHED'
);


--
-- Name: ShearingType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ShearingType" AS ENUM (
    'FULL_BODY',
    'PARTIAL',
    'BELLY_CRUTCH'
);


--
-- Name: SignatureProvider; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SignatureProvider" AS ENUM (
    'internal',
    'docusign',
    'hellosign',
    'adobe',
    'other'
);


--
-- Name: SignatureStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SignatureStatus" AS ENUM (
    'pending',
    'viewed',
    'signed',
    'declined',
    'voided',
    'expired'
);


--
-- Name: Species; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Species" AS ENUM (
    'DOG',
    'CAT',
    'HORSE',
    'GOAT',
    'RABBIT',
    'SHEEP',
    'CATTLE',
    'PIG',
    'ALPACA',
    'LLAMA'
);


--
-- Name: StoolQuality; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."StoolQuality" AS ENUM (
    'NORMAL',
    'SOFT',
    'DIARRHEA',
    'CONSTIPATED',
    'NONE'
);


--
-- Name: StudVisibilityLevel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."StudVisibilityLevel" AS ENUM (
    'TENANT',
    'PROGRAM',
    'PARTICIPANT'
);


--
-- Name: SubscriptionStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SubscriptionStatus" AS ENUM (
    'TRIAL',
    'ACTIVE',
    'PAST_DUE',
    'CANCELED',
    'EXPIRED',
    'INCOMPLETE',
    'PAUSED'
);


--
-- Name: SuccessRating; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SuccessRating" AS ENUM (
    'EXCELLENT',
    'GOOD',
    'FAIR',
    'POOR'
);


--
-- Name: SupplementFrequency; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SupplementFrequency" AS ENUM (
    'ONCE',
    'DAILY',
    'EVERY_OTHER_DAY',
    'EVERY_3_DAYS',
    'WEEKLY',
    'ONGOING'
);


--
-- Name: SupplementScheduleMode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SupplementScheduleMode" AS ENUM (
    'BREEDING_LINKED',
    'STANDALONE'
);


--
-- Name: SupplementScheduleStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SupplementScheduleStatus" AS ENUM (
    'NOT_STARTED',
    'IN_PROGRESS',
    'COMPLETED',
    'SKIPPED',
    'CANCELLED'
);


--
-- Name: SupplementTriggerType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SupplementTriggerType" AS ENUM (
    'BREEDING_CYCLE_RELATIVE',
    'AGE_BASED',
    'MANUAL'
);


--
-- Name: TagModule; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TagModule" AS ENUM (
    'CONTACT',
    'ORGANIZATION',
    'ANIMAL',
    'WAITLIST_ENTRY',
    'OFFSPRING_GROUP',
    'OFFSPRING',
    'MESSAGE_THREAD',
    'DRAFT',
    'BREEDING_PLAN',
    'BUYER',
    'DEAL',
    'DOCUMENT',
    'MEDIA'
);


--
-- Name: TaskScope; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TaskScope" AS ENUM (
    'group',
    'offspring'
);


--
-- Name: TaskStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TaskStatus" AS ENUM (
    'open',
    'in_progress',
    'done',
    'cancelled'
);


--
-- Name: TemplateCategory; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TemplateCategory" AS ENUM (
    'auto_reply',
    'invoice_message',
    'birth_announcement',
    'waitlist_update',
    'general_follow_up',
    'custom'
);


--
-- Name: TemplateChannel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TemplateChannel" AS ENUM (
    'email',
    'dm',
    'social'
);


--
-- Name: TemplateStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TemplateStatus" AS ENUM (
    'draft',
    'active',
    'archived'
);


--
-- Name: TenantMembershipRole; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TenantMembershipRole" AS ENUM (
    'STAFF',
    'CLIENT'
);


--
-- Name: TenantMembershipStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TenantMembershipStatus" AS ENUM (
    'INVITED',
    'ACTIVE',
    'SUSPENDED'
);


--
-- Name: TenantOperationType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TenantOperationType" AS ENUM (
    'HOBBY',
    'COMMERCIAL',
    'PERFORMANCE'
);


--
-- Name: TenantRole; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TenantRole" AS ENUM (
    'OWNER',
    'ADMIN',
    'MEMBER',
    'BILLING',
    'VIEWER'
);


--
-- Name: TitleCategory; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TitleCategory" AS ENUM (
    'CONFORMATION',
    'OBEDIENCE',
    'AGILITY',
    'FIELD',
    'HERDING',
    'TRACKING',
    'RALLY',
    'PRODUCING',
    'BREED_SPECIFIC',
    'PERFORMANCE',
    'OTHER'
);


--
-- Name: TitleStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TitleStatus" AS ENUM (
    'IN_PROGRESS',
    'EARNED',
    'VERIFIED'
);


--
-- Name: TraitSource; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TraitSource" AS ENUM (
    'SELF_REPORTED',
    'VET',
    'LAB',
    'REGISTRY'
);


--
-- Name: TraitStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TraitStatus" AS ENUM (
    'NOT_PROVIDED',
    'PROVIDED',
    'PENDING',
    'PASS',
    'FAIL'
);


--
-- Name: TraitValueType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TraitValueType" AS ENUM (
    'BOOLEAN',
    'ENUM',
    'NUMBER',
    'DATE',
    'TEXT',
    'JSON'
);


--
-- Name: UsageMetricKey; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."UsageMetricKey" AS ENUM (
    'ANIMAL_COUNT',
    'CONTACT_COUNT',
    'PORTAL_USER_COUNT',
    'BREEDING_PLAN_COUNT',
    'MARKETPLACE_LISTING_COUNT',
    'STORAGE_BYTES',
    'SMS_SENT',
    'API_CALLS'
);


--
-- Name: VerificationConfidence; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."VerificationConfidence" AS ENUM (
    'HIGH',
    'MEDIUM',
    'LOW',
    'NONE'
);


--
-- Name: VerificationMethod; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."VerificationMethod" AS ENUM (
    'API',
    'MANUAL',
    'DOCUMENT'
);


--
-- Name: VerificationPurpose; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."VerificationPurpose" AS ENUM (
    'VERIFY_EMAIL',
    'RESET_PASSWORD',
    'INVITE',
    'OTHER'
);


--
-- Name: WaitlistStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."WaitlistStatus" AS ENUM (
    'INQUIRY',
    'DEPOSIT_DUE',
    'DEPOSIT_PAID',
    'READY',
    'ALLOCATED',
    'COMPLETED',
    'CANCELED',
    'APPROVED',
    'REJECTED'
);


--
-- Name: capture_table_stats(); Type: FUNCTION; Schema: _monitoring; Owner: -
--

CREATE FUNCTION _monitoring.capture_table_stats() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    rows_inserted INTEGER;
BEGIN
    INSERT INTO _monitoring.table_stats (
        captured_at, schema_name, table_name,
        row_count, total_bytes, index_bytes, toast_bytes,
        inserts, updates, deletes, dead_tuples,
        seq_scans, idx_scans
    )
    SELECT
        NOW(),
        s.schemaname,
        s.relname,
        s.n_live_tup,
        pg_total_relation_size(s.relid),
        pg_indexes_size(s.relid),
        COALESCE(pg_total_relation_size(s.relid) - pg_relation_size(s.relid) - pg_indexes_size(s.relid), 0),
        s.n_tup_ins,
        s.n_tup_upd,
        s.n_tup_del,
        s.n_dead_tup,
        s.seq_scan,
        s.idx_scan
    FROM pg_stat_user_tables s
    WHERE s.schemaname IN ('public', 'marketplace');

    GET DIAGNOSTICS rows_inserted = ROW_COUNT;
    RETURN rows_inserted;
END;
$$;


--
-- Name: FUNCTION capture_table_stats(); Type: COMMENT; Schema: _monitoring; Owner: -
--

COMMENT ON FUNCTION _monitoring.capture_table_stats() IS 'Capture a point-in-time snapshot of all user table sizes and activity counters';


--
-- Name: purge_old_stats(integer); Type: FUNCTION; Schema: _monitoring; Owner: -
--

CREATE FUNCTION _monitoring.purge_old_stats(retention_days integer DEFAULT 90) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    rows_deleted INTEGER;
BEGIN
    DELETE FROM _monitoring.table_stats
    WHERE captured_at < NOW() - (retention_days || ' days')::INTERVAL;

    GET DIAGNOSTICS rows_deleted = ROW_COUNT;
    RETURN rows_deleted;
END;
$$;


--
-- Name: FUNCTION purge_old_stats(retention_days integer); Type: COMMENT; Schema: _monitoring; Owner: -
--

COMMENT ON FUNCTION _monitoring.purge_old_stats(retention_days integer) IS 'Remove monitoring snapshots older than N days (default 90)';


--
-- Name: normalize_locus_code(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_locus_code(code text, species text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
  code_upper TEXT;
  species_upper TEXT;
BEGIN
  code_upper := UPPER(TRIM(REGEXP_REPLACE(code, '[-_\s]', '_', 'g')));
  species_upper := UPPER(COALESCE(species, 'DOG'));

  -- Horse mappings (most common in your system)
  IF species_upper = 'HORSE' THEN
    CASE code_upper
      WHEN 'EXTENSION' THEN RETURN 'E';
      WHEN 'AGOUTI' THEN RETURN 'A';
      WHEN 'CREAM', 'CREAM_DILUTION' THEN RETURN 'Cr';
      WHEN 'DUN', 'DUN_DILUTION' THEN RETURN 'D';
      WHEN 'GRAY', 'GREY', 'PROGRESSIVE_GRAY' THEN RETURN 'G';
      WHEN 'CHAMPAGNE', 'CHAMPAGNE_DILUTION' THEN RETURN 'Ch';
      WHEN 'SILVER', 'SILVER_DAPPLE' THEN RETURN 'Z';
      WHEN 'TOBIANO', 'TOBIANO_SPOTTING' THEN RETURN 'TO';
      WHEN 'OVERO', 'FRAME', 'FRAME_OVERO', 'OLWS' THEN RETURN 'O';
      WHEN 'SABINO', 'SABINO_SPOTTING' THEN RETURN 'SB';
      WHEN 'LEOPARD_COMPLEX', 'LEOPARD', 'APPALOOSA' THEN RETURN 'LP';
      WHEN 'ROAN' THEN RETURN 'Rn';
      WHEN 'DOMINANT_WHITE', 'WHITE' THEN RETURN 'W';
      WHEN 'SPLASHED_WHITE', 'SPLASH' THEN RETURN 'SW';
      WHEN 'HYPERKALEMIC_PERIODIC_PARALYSIS', 'HYPP_GENE' THEN RETURN 'HYPP';
      WHEN 'GLYCOGEN_BRANCHING_ENZYME_DEFICIENCY', 'GBED_GENE' THEN RETURN 'GBED';
      WHEN 'HEREDITARY_EQUINE_REGIONAL_DERMAL_ASTHENIA', 'HERDA_GENE' THEN RETURN 'HERDA';
      WHEN 'POLYSACCHARIDE_STORAGE_MYOPATHY_TYPE_1', 'PSSM_TYPE_1', 'PSSM1_GENE' THEN RETURN 'PSSM1';
      WHEN 'POLYSACCHARIDE_STORAGE_MYOPATHY_TYPE_2', 'PSSM_TYPE_2' THEN RETURN 'PSSM2';
      WHEN 'MALIGNANT_HYPERTHERMIA', 'MH_GENE' THEN RETURN 'MH';
      WHEN 'MYOSTATIN', 'SPEED_GENE', 'SPEED' THEN RETURN 'MSTN';
      WHEN 'GAIT_KEEPER', 'GAIT', 'GAITED' THEN RETURN 'DMRT3';
      ELSE RETURN code; -- Already short code
    END CASE;
  END IF;

  -- Dog mappings
  IF species_upper = 'DOG' THEN
    CASE code_upper
      WHEN 'EXTENSION' THEN RETURN 'E';
      WHEN 'AGOUTI' THEN RETURN 'A';
      WHEN 'BROWN' THEN RETURN 'B';
      WHEN 'DILUTE' THEN RETURN 'D';
      WHEN 'BLACK_EXTENSION', 'DOMINANT_BLACK' THEN RETURN 'K';
      WHEN 'MERLE' THEN RETURN 'M';
      WHEN 'WHITE_SPOTTING', 'SPOTTING' THEN RETURN 'S';
      WHEN 'LONG_HAIR', 'LENGTH' THEN RETURN 'L';
      WHEN 'FURNISHINGS' THEN RETURN 'F';
      ELSE RETURN code;
    END CASE;
  END IF;

  -- Default: return original code
  RETURN code;
END;
$$;


--
-- Name: sync_animal_loci_from_genetics(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_animal_loci_from_genetics() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  species_val TEXT;
  category_name TEXT;
  locus_obj JSONB;
  normalized_locus TEXT;
  category_field TEXT;
BEGIN
  -- Get animal species for code normalization
  SELECT species INTO species_val FROM "Animal" WHERE id = NEW."animalId";
  species_val := COALESCE(species_val, 'DOG');

  -- Delete existing loci for this animal
  DELETE FROM animal_loci WHERE animal_id = NEW."animalId";

  -- Process each category's JSONB array
  -- Only include columns that actually exist in AnimalGenetics table
  FOR category_name, category_field IN VALUES
    ('coatColor', 'coatColorData'),
    ('coatType', 'coatTypeData'),
    ('physicalTraits', 'physicalTraitsData'),
    ('eyeColor', 'eyeColorData'),
    ('health', 'healthGeneticsData'),
    ('otherTraits', 'otherTraitsData')
  LOOP
    -- Process each locus in the array
    -- CASE statement returns empty array if column is NULL, so no need to check
    FOR locus_obj IN SELECT * FROM jsonb_array_elements(
      CASE category_field
        WHEN 'coatColorData' THEN NEW."coatColorData"
        WHEN 'coatTypeData' THEN NEW."coatTypeData"
        WHEN 'physicalTraitsData' THEN NEW."physicalTraitsData"
        WHEN 'eyeColorData' THEN NEW."eyeColorData"
        WHEN 'healthGeneticsData' THEN NEW."healthGeneticsData"
        WHEN 'otherTraitsData' THEN NEW."otherTraitsData"
        ELSE '[]'::jsonb
      END
    )
    LOOP
      -- Skip if locus field is missing
      CONTINUE WHEN (locus_obj->>'locus' IS NULL);

      -- Normalize the locus code
      normalized_locus := normalize_locus_code(locus_obj->>'locus', species_val);

      -- Insert into animal_loci
      INSERT INTO animal_loci (
        animal_id, category, locus, locus_name,
        allele1, allele2, genotype, network_visible,
        created_at, updated_at
      ) VALUES (
        NEW."animalId",
        category_name,
        normalized_locus,
        COALESCE(locus_obj->>'locusName', normalized_locus),
        locus_obj->>'allele1',
        locus_obj->>'allele2',
        locus_obj->>'genotype',
        COALESCE((locus_obj->>'networkVisible')::boolean, false),
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (animal_id, category, locus) DO UPDATE SET
        locus_name = EXCLUDED.locus_name,
        allele1 = EXCLUDED.allele1,
        allele2 = EXCLUDED.allele2,
        genotype = EXCLUDED.genotype,
        network_visible = EXCLUDED.network_visible,
        updated_at = CURRENT_TIMESTAMP;
    END LOOP;
  END LOOP;

  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: table_stats; Type: TABLE; Schema: _monitoring; Owner: -
--

CREATE TABLE _monitoring.table_stats (
    id bigint NOT NULL,
    captured_at timestamp with time zone DEFAULT now() NOT NULL,
    schema_name text NOT NULL,
    table_name text NOT NULL,
    row_count bigint DEFAULT 0 NOT NULL,
    total_bytes bigint DEFAULT 0 NOT NULL,
    index_bytes bigint DEFAULT 0 NOT NULL,
    toast_bytes bigint DEFAULT 0 NOT NULL,
    inserts bigint DEFAULT 0 NOT NULL,
    updates bigint DEFAULT 0 NOT NULL,
    deletes bigint DEFAULT 0 NOT NULL,
    dead_tuples bigint DEFAULT 0 NOT NULL,
    seq_scans bigint DEFAULT 0 NOT NULL,
    idx_scans bigint DEFAULT 0 NOT NULL
);


--
-- Name: table_stats_id_seq; Type: SEQUENCE; Schema: _monitoring; Owner: -
--

ALTER TABLE _monitoring.table_stats ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME _monitoring.table_stats_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: v_growth_rate; Type: VIEW; Schema: _monitoring; Owner: -
--

CREATE VIEW _monitoring.v_growth_rate AS
 WITH ranked AS (
         SELECT table_stats.schema_name,
            table_stats.table_name,
            table_stats.captured_at,
            table_stats.row_count,
            table_stats.total_bytes,
            table_stats.inserts,
            lag(table_stats.row_count) OVER (PARTITION BY table_stats.schema_name, table_stats.table_name ORDER BY table_stats.captured_at) AS prev_row_count,
            lag(table_stats.total_bytes) OVER (PARTITION BY table_stats.schema_name, table_stats.table_name ORDER BY table_stats.captured_at) AS prev_bytes,
            lag(table_stats.inserts) OVER (PARTITION BY table_stats.schema_name, table_stats.table_name ORDER BY table_stats.captured_at) AS prev_inserts,
            lag(table_stats.captured_at) OVER (PARTITION BY table_stats.schema_name, table_stats.table_name ORDER BY table_stats.captured_at) AS prev_captured_at
           FROM _monitoring.table_stats
        )
 SELECT schema_name,
    table_name,
    captured_at,
    row_count,
    pg_size_pretty(total_bytes) AS total_size,
    (row_count - COALESCE(prev_row_count, row_count)) AS row_growth,
    pg_size_pretty((total_bytes - COALESCE(prev_bytes, total_bytes))) AS size_growth,
    (inserts - COALESCE(prev_inserts, inserts)) AS new_inserts,
    (EXTRACT(epoch FROM (captured_at - prev_captured_at)) / 3600.0) AS hours_between
   FROM ranked
  WHERE (prev_captured_at IS NOT NULL)
  ORDER BY captured_at DESC, (row_count - COALESCE(prev_row_count, row_count)) DESC;


--
-- Name: v_missing_indexes; Type: VIEW; Schema: _monitoring; Owner: -
--

CREATE VIEW _monitoring.v_missing_indexes AS
 SELECT schemaname AS schema_name,
    relname AS table_name,
    seq_scan,
    idx_scan,
        CASE
            WHEN ((seq_scan + idx_scan) > 0) THEN round((((seq_scan)::numeric / ((seq_scan + idx_scan))::numeric) * (100)::numeric), 1)
            ELSE (0)::numeric
        END AS seq_scan_pct,
    n_live_tup AS row_count,
    pg_size_pretty(pg_total_relation_size((relid)::regclass)) AS total_size
   FROM pg_stat_user_tables
  WHERE ((schemaname = ANY (ARRAY['public'::name, 'marketplace'::name])) AND (n_live_tup > 500) AND (seq_scan > idx_scan))
  ORDER BY
        CASE
            WHEN ((seq_scan + idx_scan) > 0) THEN round((((seq_scan)::numeric / ((seq_scan + idx_scan))::numeric) * (100)::numeric), 1)
            ELSE (0)::numeric
        END DESC;


--
-- Name: v_table_bloat; Type: VIEW; Schema: _monitoring; Owner: -
--

CREATE VIEW _monitoring.v_table_bloat AS
 SELECT schemaname AS schema_name,
    relname AS table_name,
    n_live_tup AS live_tuples,
    n_dead_tup AS dead_tuples,
        CASE
            WHEN (n_live_tup > 0) THEN round((((n_dead_tup)::numeric / (n_live_tup)::numeric) * (100)::numeric), 1)
            ELSE (0)::numeric
        END AS dead_pct,
    last_autovacuum,
    last_autoanalyze
   FROM pg_stat_user_tables
  WHERE ((schemaname = ANY (ARRAY['public'::name, 'marketplace'::name])) AND (n_dead_tup > 100))
  ORDER BY
        CASE
            WHEN (n_live_tup > 0) THEN round((((n_dead_tup)::numeric / (n_live_tup)::numeric) * (100)::numeric), 1)
            ELSE (0)::numeric
        END DESC;


--
-- Name: v_table_sizes; Type: VIEW; Schema: _monitoring; Owner: -
--

CREATE VIEW _monitoring.v_table_sizes AS
 SELECT schemaname AS schema_name,
    relname AS table_name,
    n_live_tup AS row_count,
    pg_size_pretty(pg_total_relation_size((relid)::regclass)) AS total_size,
    pg_size_pretty(pg_indexes_size((relid)::regclass)) AS index_size,
    pg_total_relation_size((relid)::regclass) AS total_bytes
   FROM pg_stat_user_tables
  WHERE (schemaname = ANY (ARRAY['public'::name, 'marketplace'::name]))
  ORDER BY (pg_total_relation_size((relid)::regclass)) DESC;


--
-- Name: mkt_listing_breeder_service; Type: TABLE; Schema: marketplace; Owner: -
--

CREATE TABLE marketplace.mkt_listing_breeder_service (
    id integer NOT NULL,
    source_type marketplace."ServiceSourceType" NOT NULL,
    provider_id integer,
    tenant_id integer,
    slug text NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    category character varying(100) NOT NULL,
    subcategory character varying(100),
    custom_service_type character varying(50),
    price_cents bigint,
    price_type character varying(50),
    price_text character varying(100),
    images jsonb,
    cover_image_url character varying(500),
    city character varying(100),
    state character varying(50),
    zip character varying(20),
    country character varying(2),
    latitude numeric(10,8),
    longitude numeric(11,8),
    duration character varying(100),
    availability text,
    meta_description text,
    keywords text,
    view_count integer DEFAULT 0 NOT NULL,
    inquiry_count integer DEFAULT 0 NOT NULL,
    booking_count integer DEFAULT 0 NOT NULL,
    status public."MarketplaceListingStatus" DEFAULT 'DRAFT'::public."MarketplaceListingStatus" NOT NULL,
    published_at timestamp(3) without time zone,
    paused_at timestamp(3) without time zone,
    flagged boolean DEFAULT false NOT NULL,
    flagged_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone,
    featured_until timestamp(3) without time zone,
    is_featured boolean DEFAULT false NOT NULL,
    current_period_end timestamp(3) without time zone,
    expires_at timestamp(3) without time zone,
    is_founding boolean DEFAULT false NOT NULL,
    listing_fee_cents integer DEFAULT 499 NOT NULL,
    paid_at timestamp(3) without time zone,
    stripe_subscription_id text,
    stripe_subscription_status text,
    CONSTRAINT provider_xor_tenant CHECK ((((source_type = 'PROVIDER'::marketplace."ServiceSourceType") AND (provider_id IS NOT NULL) AND (tenant_id IS NULL)) OR ((source_type = 'BREEDER'::marketplace."ServiceSourceType") AND (tenant_id IS NOT NULL) AND (provider_id IS NULL))))
);


--
-- Name: MktListingService_id_seq; Type: SEQUENCE; Schema: marketplace; Owner: -
--

CREATE SEQUENCE marketplace."MktListingService_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: MktListingService_id_seq; Type: SEQUENCE OWNED BY; Schema: marketplace; Owner: -
--

ALTER SEQUENCE marketplace."MktListingService_id_seq" OWNED BY marketplace.mkt_listing_breeder_service.id;


--
-- Name: abuse_reports; Type: TABLE; Schema: marketplace; Owner: -
--

CREATE TABLE marketplace.abuse_reports (
    id integer NOT NULL,
    listing_id integer NOT NULL,
    reason text NOT NULL,
    details text,
    reporter_email text,
    status text DEFAULT 'pending'::text NOT NULL,
    admin_notes text,
    resolved_at timestamp(3) without time zone,
    resolved_by_id integer,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: abuse_reports_id_seq; Type: SEQUENCE; Schema: marketplace; Owner: -
--

CREATE SEQUENCE marketplace.abuse_reports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: abuse_reports_id_seq; Type: SEQUENCE OWNED BY; Schema: marketplace; Owner: -
--

ALTER SEQUENCE marketplace.abuse_reports_id_seq OWNED BY marketplace.abuse_reports.id;


--
-- Name: international_waitlist; Type: TABLE; Schema: marketplace; Owner: -
--

CREATE TABLE marketplace.international_waitlist (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    first_name character varying(100),
    last_name character varying(100),
    country character varying(2) NOT NULL,
    country_name character varying(100),
    source character varying(50) DEFAULT 'registration_gate'::character varying NOT NULL,
    notes text,
    notified_at timestamp without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: international_waitlist_id_seq; Type: SEQUENCE; Schema: marketplace; Owner: -
--

CREATE SEQUENCE marketplace.international_waitlist_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: international_waitlist_id_seq; Type: SEQUENCE OWNED BY; Schema: marketplace; Owner: -
--

ALTER SEQUENCE marketplace.international_waitlist_id_seq OWNED BY marketplace.international_waitlist.id;


--
-- Name: invoices; Type: TABLE; Schema: marketplace; Owner: -
--

CREATE TABLE marketplace.invoices (
    id integer NOT NULL,
    transaction_id bigint NOT NULL,
    provider_id integer NOT NULL,
    client_id integer NOT NULL,
    invoice_number text NOT NULL,
    total_cents bigint NOT NULL,
    balance_cents bigint NOT NULL,
    refunded_cents bigint DEFAULT 0 NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    payment_mode text DEFAULT 'stripe'::text NOT NULL,
    payment_mode_locked_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    stripe_invoice_id text,
    stripe_payment_intent_id text,
    buyer_marked_paid_at timestamp(3) without time zone,
    buyer_payment_method text,
    buyer_payment_reference text,
    provider_confirmed_at timestamp(3) without time zone,
    provider_confirmed_by integer,
    issued_at timestamp(3) without time zone,
    due_at timestamp(3) without time zone,
    paid_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    internal_notes text,
    manual_payment_confirmed_by integer,
    manual_payment_marked_at timestamp(3) without time zone,
    manual_payment_method text,
    manual_payment_reference text,
    notes text,
    paid_cents bigint DEFAULT 0 NOT NULL,
    refunded_at timestamp(3) without time zone,
    sent_at timestamp(3) without time zone,
    stripe_charge_id text,
    subtotal_cents bigint NOT NULL,
    tax_cents bigint DEFAULT 0 NOT NULL,
    viewed_at timestamp(3) without time zone,
    voided_at timestamp(3) without time zone,
    stripe_invoice_pdf_url text,
    stripe_invoice_sent_at timestamp(3) without time zone,
    stripe_invoice_url text
);


--
-- Name: invoices_id_seq; Type: SEQUENCE; Schema: marketplace; Owner: -
--

CREATE SEQUENCE marketplace.invoices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: invoices_id_seq; Type: SEQUENCE OWNED BY; Schema: marketplace; Owner: -
--

ALTER SEQUENCE marketplace.invoices_id_seq OWNED BY marketplace.invoices.id;


--
-- Name: message_threads; Type: TABLE; Schema: marketplace; Owner: -
--

CREATE TABLE marketplace.message_threads (
    id integer NOT NULL,
    client_id integer NOT NULL,
    provider_id integer NOT NULL,
    listing_id integer,
    transaction_id bigint,
    subject text,
    status text DEFAULT 'active'::text NOT NULL,
    last_message_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    archived_by_provider_at timestamp(3) without time zone,
    deleted_by_provider_at timestamp(3) without time zone,
    first_client_message_at timestamp(3) without time zone,
    first_provider_reply_at timestamp(3) without time zone,
    response_time_seconds integer
);


--
-- Name: message_threads_id_seq; Type: SEQUENCE; Schema: marketplace; Owner: -
--

CREATE SEQUENCE marketplace.message_threads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: message_threads_id_seq; Type: SEQUENCE OWNED BY; Schema: marketplace; Owner: -
--

ALTER SEQUENCE marketplace.message_threads_id_seq OWNED BY marketplace.message_threads.id;


--
-- Name: messages; Type: TABLE; Schema: marketplace; Owner: -
--

CREATE TABLE marketplace.messages (
    id bigint NOT NULL,
    thread_id integer NOT NULL,
    sender_id integer NOT NULL,
    message_text text NOT NULL,
    read_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    sender_type text DEFAULT 'client'::text NOT NULL,
    deleted_at timestamp(3) without time zone
);


--
-- Name: messages_id_seq; Type: SEQUENCE; Schema: marketplace; Owner: -
--

CREATE SEQUENCE marketplace.messages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: messages_id_seq; Type: SEQUENCE OWNED BY; Schema: marketplace; Owner: -
--

ALTER SEQUENCE marketplace.messages_id_seq OWNED BY marketplace.messages.id;


--
-- Name: mobile_refresh_tokens; Type: TABLE; Schema: marketplace; Owner: -
--

CREATE TABLE marketplace.mobile_refresh_tokens (
    id integer NOT NULL,
    user_id integer NOT NULL,
    token_hash character varying(64) NOT NULL,
    device_id character varying(255),
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    revoked_at timestamp with time zone
);


--
-- Name: mobile_refresh_tokens_id_seq; Type: SEQUENCE; Schema: marketplace; Owner: -
--

CREATE SEQUENCE marketplace.mobile_refresh_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: mobile_refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: marketplace; Owner: -
--

ALTER SEQUENCE marketplace.mobile_refresh_tokens_id_seq OWNED BY marketplace.mobile_refresh_tokens.id;


--
-- Name: provider_reports; Type: TABLE; Schema: marketplace; Owner: -
--

CREATE TABLE marketplace.provider_reports (
    id integer NOT NULL,
    provider_id integer NOT NULL,
    reporter_user_id character varying(36) NOT NULL,
    reporter_email text,
    reason text NOT NULL,
    severity text NOT NULL,
    details text,
    related_listing_ids integer[] DEFAULT ARRAY[]::integer[],
    related_transaction_id bigint,
    status text DEFAULT 'pending'::text NOT NULL,
    admin_notes text,
    reviewed_at timestamp(3) without time zone,
    reviewed_by integer,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: provider_reports_id_seq; Type: SEQUENCE; Schema: marketplace; Owner: -
--

CREATE SEQUENCE marketplace.provider_reports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: provider_reports_id_seq; Type: SEQUENCE OWNED BY; Schema: marketplace; Owner: -
--

ALTER SEQUENCE marketplace.provider_reports_id_seq OWNED BY marketplace.provider_reports.id;


--
-- Name: provider_terms_acceptance; Type: TABLE; Schema: marketplace; Owner: -
--

CREATE TABLE marketplace.provider_terms_acceptance (
    id integer NOT NULL,
    user_id integer NOT NULL,
    version character varying(16) NOT NULL,
    accepted_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    ip_address character varying(45),
    user_agent text
);


--
-- Name: provider_terms_acceptance_id_seq; Type: SEQUENCE; Schema: marketplace; Owner: -
--

CREATE SEQUENCE marketplace.provider_terms_acceptance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: provider_terms_acceptance_id_seq; Type: SEQUENCE OWNED BY; Schema: marketplace; Owner: -
--

ALTER SEQUENCE marketplace.provider_terms_acceptance_id_seq OWNED BY marketplace.provider_terms_acceptance.id;


--
-- Name: providers; Type: TABLE; Schema: marketplace; Owner: -
--

CREATE TABLE marketplace.providers (
    id integer NOT NULL,
    user_id integer NOT NULL,
    provider_type text NOT NULL,
    tenant_id integer,
    business_name text NOT NULL,
    business_description text,
    city text,
    state text,
    stripe_connect_account_id text,
    stripe_connect_onboarding_complete boolean DEFAULT false NOT NULL,
    stripe_connect_payouts_enabled boolean DEFAULT false NOT NULL,
    payment_mode text DEFAULT 'manual'::text NOT NULL,
    payment_instructions text,
    total_listings integer DEFAULT 0 NOT NULL,
    total_transactions integer DEFAULT 0 NOT NULL,
    total_revenue_cents bigint DEFAULT 0 NOT NULL,
    average_rating numeric(3,2) DEFAULT 0.00 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    activated_at timestamp(3) without time zone,
    active_listings integer DEFAULT 0 NOT NULL,
    business_hours jsonb,
    completed_transactions integer DEFAULT 0 NOT NULL,
    country text DEFAULT 'US'::text,
    cover_image_url text,
    deleted_at timestamp(3) without time zone,
    lifetime_payout_cents bigint DEFAULT 0 NOT NULL,
    logo_url text,
    premium_provider boolean DEFAULT false NOT NULL,
    public_email text,
    public_phone text,
    quick_responder boolean DEFAULT false NOT NULL,
    stripe_connect_details_submitted boolean DEFAULT false NOT NULL,
    suspended_at timestamp(3) without time zone,
    suspended_reason text,
    time_zone text DEFAULT 'America/New_York'::text,
    total_reviews integer DEFAULT 0 NOT NULL,
    verified_provider boolean DEFAULT false NOT NULL,
    website text,
    zip text,
    latitude numeric(10,8),
    longitude numeric(11,8),
    accredited_package_approved_at timestamp(3) without time zone,
    accredited_package_approved_by integer,
    accredited_package_expires_at timestamp(3) without time zone,
    accredited_package_purchased_at timestamp(3) without time zone,
    established_badge boolean DEFAULT false NOT NULL,
    established_badge_earned_at timestamp(3) without time zone,
    identity_verified_at timestamp(3) without time zone,
    phone_verification_token text,
    phone_verification_token_expires timestamp(3) without time zone,
    phone_verified_at timestamp(3) without time zone,
    stripe_identity_session_id text,
    stripe_identity_status text,
    top_rated_badge boolean DEFAULT false NOT NULL,
    top_rated_badge_earned_at timestamp(3) without time zone,
    trusted_badge boolean DEFAULT false NOT NULL,
    trusted_badge_earned_at timestamp(3) without time zone,
    verification_tier marketplace."BreederVerificationTier" DEFAULT 'SUBSCRIBER'::marketplace."BreederVerificationTier" NOT NULL,
    verification_tier_achieved_at timestamp(3) without time zone,
    verified_package_approved_at timestamp(3) without time zone,
    verified_package_approved_by integer,
    verified_package_expires_at timestamp(3) without time zone,
    verified_package_purchased_at timestamp(3) without time zone,
    listing_fee_exempt boolean DEFAULT true NOT NULL,
    listing_fee_exempt_until timestamp(3) without time zone,
    listing_tier text,
    max_active_listings integer,
    flag_reason text,
    flagged_at timestamp(3) without time zone
);


--
-- Name: providers_id_seq; Type: SEQUENCE; Schema: marketplace; Owner: -
--

CREATE SEQUENCE marketplace.providers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: providers_id_seq; Type: SEQUENCE OWNED BY; Schema: marketplace; Owner: -
--

ALTER SEQUENCE marketplace.providers_id_seq OWNED BY marketplace.providers.id;


--
-- Name: reviews; Type: TABLE; Schema: marketplace; Owner: -
--

CREATE TABLE marketplace.reviews (
    id integer NOT NULL,
    transaction_id bigint NOT NULL,
    provider_id integer NOT NULL,
    client_id integer NOT NULL,
    listing_id integer,
    rating integer NOT NULL,
    title text,
    review_text text,
    provider_response text,
    responded_at timestamp(3) without time zone,
    status text DEFAULT 'published'::text NOT NULL,
    flagged_reason text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: reviews_id_seq; Type: SEQUENCE; Schema: marketplace; Owner: -
--

CREATE SEQUENCE marketplace.reviews_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: reviews_id_seq; Type: SEQUENCE OWNED BY; Schema: marketplace; Owner: -
--

ALTER SEQUENCE marketplace.reviews_id_seq OWNED BY marketplace.reviews.id;


--
-- Name: saved_listings; Type: TABLE; Schema: marketplace; Owner: -
--

CREATE TABLE marketplace.saved_listings (
    id integer NOT NULL,
    listing_id integer NOT NULL,
    saved_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    bhq_user_id character varying(36) NOT NULL,
    listing_type character varying(20) NOT NULL
);


--
-- Name: saved_listings_id_seq; Type: SEQUENCE; Schema: marketplace; Owner: -
--

CREATE SEQUENCE marketplace.saved_listings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: saved_listings_id_seq; Type: SEQUENCE OWNED BY; Schema: marketplace; Owner: -
--

ALTER SEQUENCE marketplace.saved_listings_id_seq OWNED BY marketplace.saved_listings.id;


--
-- Name: service_tag_assignments; Type: TABLE; Schema: marketplace; Owner: -
--

CREATE TABLE marketplace.service_tag_assignments (
    listing_id integer NOT NULL,
    tag_id integer NOT NULL
);


--
-- Name: service_tags; Type: TABLE; Schema: marketplace; Owner: -
--

CREATE TABLE marketplace.service_tags (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    slug character varying(100) NOT NULL,
    usage_count integer DEFAULT 0 NOT NULL,
    suggested boolean DEFAULT false NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: service_tags_id_seq; Type: SEQUENCE; Schema: marketplace; Owner: -
--

CREATE SEQUENCE marketplace.service_tags_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: service_tags_id_seq; Type: SEQUENCE OWNED BY; Schema: marketplace; Owner: -
--

ALTER SEQUENCE marketplace.service_tags_id_seq OWNED BY marketplace.service_tags.id;


--
-- Name: stripe_identity_sessions; Type: TABLE; Schema: marketplace; Owner: -
--

CREATE TABLE marketplace.stripe_identity_sessions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    stripe_session_id character varying(255) NOT NULL,
    client_secret text NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    verified_at timestamp(3) without time zone,
    stripe_response jsonb,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: stripe_identity_sessions_id_seq; Type: SEQUENCE; Schema: marketplace; Owner: -
--

CREATE SEQUENCE marketplace.stripe_identity_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stripe_identity_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: marketplace; Owner: -
--

ALTER SEQUENCE marketplace.stripe_identity_sessions_id_seq OWNED BY marketplace.stripe_identity_sessions.id;


--
-- Name: transactions; Type: TABLE; Schema: marketplace; Owner: -
--

CREATE TABLE marketplace.transactions (
    id bigint NOT NULL,
    client_id integer NOT NULL,
    provider_id integer NOT NULL,
    listing_id integer,
    service_description text NOT NULL,
    invoice_type text,
    tenant_id integer,
    invoice_id integer,
    total_cents bigint NOT NULL,
    platform_fee_cents bigint DEFAULT 0 NOT NULL,
    provider_payout_cents bigint,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    invoiced_at timestamp(3) without time zone,
    paid_at timestamp(3) without time zone,
    completed_at timestamp(3) without time zone,
    cancellation_reason text,
    cancelled_at timestamp(3) without time zone,
    cancelled_by text,
    refund_amount_cents bigint DEFAULT 0 NOT NULL,
    refund_reason text,
    refunded_at timestamp(3) without time zone,
    service_notes text,
    service_price_cents bigint NOT NULL,
    started_at timestamp(3) without time zone,
    stripe_fees_cents bigint DEFAULT 0 NOT NULL,
    tax_cents bigint DEFAULT 0 NOT NULL,
    tax_rate numeric(5,4)
);


--
-- Name: transactions_id_seq; Type: SEQUENCE; Schema: marketplace; Owner: -
--

CREATE SEQUENCE marketplace.transactions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: marketplace; Owner: -
--

ALTER SEQUENCE marketplace.transactions_id_seq OWNED BY marketplace.transactions.id;


--
-- Name: users; Type: TABLE; Schema: marketplace; Owner: -
--

CREATE TABLE marketplace.users (
    id integer NOT NULL,
    email text NOT NULL,
    email_verified boolean DEFAULT false NOT NULL,
    password_hash text NOT NULL,
    first_name text,
    last_name text,
    phone text,
    user_type text DEFAULT 'buyer'::text NOT NULL,
    tenant_id integer,
    tenant_verified boolean DEFAULT false NOT NULL,
    stripe_customer_id text,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    address_line1 text,
    address_line2 text,
    city text,
    country text DEFAULT 'US'::text,
    deleted_at timestamp(3) without time zone,
    email_verify_expires timestamp(3) without time zone,
    email_verify_token text,
    last_login_at timestamp(3) without time zone,
    password_reset_expires timestamp(3) without time zone,
    password_reset_token text,
    state text,
    suspended_at timestamp(3) without time zone,
    suspended_reason text,
    zip text,
    accepts_payments_badge boolean DEFAULT false NOT NULL,
    accredited_provider_approved_at timestamp(3) without time zone,
    accredited_provider_approved_by integer,
    accredited_provider_expires_at timestamp(3) without time zone,
    accredited_provider_purchased_at timestamp(3) without time zone,
    established_provider_badge boolean DEFAULT false NOT NULL,
    identity_verified_at timestamp(3) without time zone,
    passkey_counter integer,
    passkey_created_at timestamp(3) without time zone,
    passkey_credential_id text,
    passkey_public_key bytea,
    quick_responder_badge boolean DEFAULT false NOT NULL,
    service_provider_tier marketplace."ServiceProviderVerificationTier",
    service_provider_tier_achieved_at timestamp(3) without time zone,
    sms_phone_number text,
    sms_verification_token text,
    sms_verification_token_expires timestamp(3) without time zone,
    sms_verified_at timestamp(3) without time zone,
    stripe_identity_session_id text,
    stripe_identity_status text,
    top_rated_badge boolean DEFAULT false NOT NULL,
    totp_secret text,
    totp_verified_at timestamp(3) without time zone,
    trusted_provider_badge boolean DEFAULT false NOT NULL,
    two_factor_enabled boolean DEFAULT false NOT NULL,
    two_factor_enabled_at timestamp(3) without time zone,
    two_factor_method marketplace."TwoFactorMethod",
    verified_professional_approved_at timestamp(3) without time zone,
    verified_professional_approved_by integer,
    verified_professional_expires_at timestamp(3) without time zone,
    verified_professional_purchased_at timestamp(3) without time zone,
    passkey_challenge text,
    passkey_challenge_expires timestamp(3) without time zone
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: marketplace; Owner: -
--

CREATE SEQUENCE marketplace.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: marketplace; Owner: -
--

ALTER SEQUENCE marketplace.users_id_seq OWNED BY marketplace.users.id;


--
-- Name: verification_requests; Type: TABLE; Schema: marketplace; Owner: -
--

CREATE TABLE marketplace.verification_requests (
    id integer NOT NULL,
    user_type text NOT NULL,
    provider_id integer,
    marketplace_user_id integer,
    package_type text NOT NULL,
    requested_tier text NOT NULL,
    status marketplace."VerificationRequestStatus" DEFAULT 'PENDING'::marketplace."VerificationRequestStatus" NOT NULL,
    submitted_info jsonb,
    review_checklist jsonb,
    review_notes text,
    reviewed_at timestamp(3) without time zone,
    reviewed_by integer,
    info_requested_at timestamp(3) without time zone,
    info_request_note text,
    info_provided_at timestamp(3) without time zone,
    payment_intent_id text,
    amount_paid_cents integer,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: verification_requests_id_seq; Type: SEQUENCE; Schema: marketplace; Owner: -
--

CREATE SEQUENCE marketplace.verification_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: verification_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: marketplace; Owner: -
--

ALTER SEQUENCE marketplace.verification_requests_id_seq OWNED BY marketplace.verification_requests.id;


--
-- Name: ActivityCompletion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ActivityCompletion" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "assignmentId" integer NOT NULL,
    "activityId" text NOT NULL,
    scope public."RearingCompletionScope" NOT NULL,
    "offspringId" integer,
    "completedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "completedBy" text NOT NULL,
    "checklistItemKey" text,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ActivityCompletion_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."ActivityCompletion_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ActivityCompletion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."ActivityCompletion_id_seq" OWNED BY public."ActivityCompletion".id;


--
-- Name: Animal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Animal" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "organizationId" integer,
    name text NOT NULL,
    species public."Species" NOT NULL,
    sex public."Sex" NOT NULL,
    status public."AnimalStatus" DEFAULT 'ACTIVE'::public."AnimalStatus" NOT NULL,
    "intendedUse" public."HorseIntendedUse",
    "declaredValueCents" integer,
    "declaredValueCurrency" character varying(3),
    "valuationDate" timestamp(3) without time zone,
    "valuationSource" public."HorseValuationSource",
    "forSale" boolean DEFAULT false NOT NULL,
    "inSyndication" boolean DEFAULT false NOT NULL,
    "isLeased" boolean DEFAULT false NOT NULL,
    "birthDate" timestamp(3) without time zone,
    microchip text,
    notes text,
    breed text,
    "photoUrl" text,
    "canonicalBreedId" integer,
    "customBreedId" integer,
    "litterId" integer,
    "collarColorId" text,
    "collarColorName" text,
    "collarColorHex" text,
    "collarAssignedAt" timestamp(3) without time zone,
    "collarLocked" boolean DEFAULT false NOT NULL,
    "buyerPartyId" integer,
    "priceCents" integer,
    "depositCents" integer,
    "saleInvoiceId" text,
    "contractId" text,
    "contractSignedAt" timestamp(3) without time zone,
    "paidInFullAt" timestamp(3) without time zone,
    "healthCertAt" timestamp(3) without time zone,
    "microchipAppliedAt" timestamp(3) without time zone,
    "pickupAt" timestamp(3) without time zone,
    "placedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    archived boolean DEFAULT false NOT NULL,
    "femaleCycleLenOverrideDays" integer,
    "damId" integer,
    "sireId" integer,
    "coiPercent" double precision,
    "coiGenerations" integer,
    "coiCalculatedAt" timestamp(3) without time zone,
    "titlePrefix" text,
    "titleSuffix" text,
    "exchangeCode" text,
    "exchangeCodeExpiresAt" timestamp(3) without time zone,
    "deletedAt" timestamp(3) without time zone,
    "breedingAvailability" text,
    "lineDescription" text,
    "lineTypes" text[],
    "primaryLineType" text,
    "brandMark" text,
    "earTagNumber" text,
    "earTagRfidNumber" text,
    "scrapieTagNumber" text,
    "tattooNumber" text,
    "networkSearchVisible" boolean DEFAULT true NOT NULL,
    "coverImageUrl" text,
    nickname text,
    "breedingPlanId" integer
);


--
-- Name: AnimalAccess; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AnimalAccess" (
    id integer NOT NULL,
    "ownerTenantId" integer NOT NULL,
    "accessorTenantId" integer NOT NULL,
    "animalId" integer,
    "accessTier" public."AnimalAccessTier" DEFAULT 'BASIC'::public."AnimalAccessTier" NOT NULL,
    source public."AnimalAccessSource" NOT NULL,
    "shareCodeId" integer,
    "breedingPlanId" integer,
    status public."AnimalAccessStatus" DEFAULT 'ACTIVE'::public."AnimalAccessStatus" NOT NULL,
    "expiresAt" timestamp(3) without time zone,
    "animalNameSnapshot" text,
    "animalSpeciesSnapshot" public."Species",
    "animalSexSnapshot" public."Sex",
    "deletedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: AnimalAccessConversation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AnimalAccessConversation" (
    id integer NOT NULL,
    "animalAccessId" integer NOT NULL,
    "messageThreadId" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: AnimalAccessConversation_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."AnimalAccessConversation_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: AnimalAccessConversation_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."AnimalAccessConversation_id_seq" OWNED BY public."AnimalAccessConversation".id;


--
-- Name: AnimalAccess_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."AnimalAccess_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: AnimalAccess_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."AnimalAccess_id_seq" OWNED BY public."AnimalAccess".id;


--
-- Name: AnimalBreed; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AnimalBreed" (
    id integer NOT NULL,
    "animalId" integer NOT NULL,
    "breedId" integer NOT NULL,
    percentage double precision DEFAULT 100 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: AnimalBreed_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."AnimalBreed_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: AnimalBreed_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."AnimalBreed_id_seq" OWNED BY public."AnimalBreed".id;


--
-- Name: AnimalBreedingProfile; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AnimalBreedingProfile" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "animalId" integer NOT NULL,
    "breedingStatus" text DEFAULT 'INTACT'::text NOT NULL,
    "statusNotes" text,
    "statusChangedAt" timestamp(3) without time zone,
    "environmentPreference" character varying(50),
    "environmentNotes" text,
    temperament character varying(50),
    "temperamentNotes" text,
    "specialRequirements" text,
    "generalNotes" text,
    libido character varying(20),
    "libidoNotes" text,
    "serviceType" character varying(20),
    "collectionTrained" boolean,
    "collectionNotes" text,
    "fertilityStatus" character varying(20),
    "lastFertilityTestDate" date,
    "lastFertilityTestResult" text,
    "fertilityNotes" text,
    "heatCycleRegularity" character varying(20),
    "avgCycleLengthDays" integer,
    "lastHeatDate" date,
    "heatNotes" text,
    "pregnancyComplications" text,
    "proneToComplications" boolean DEFAULT false NOT NULL,
    "naturalBirthCount" integer DEFAULT 0 NOT NULL,
    "cSectionCount" integer DEFAULT 0 NOT NULL,
    "cSectionNotes" text,
    "lastBirthType" character varying(20),
    "lastBirthDate" date,
    "maternalRating" character varying(20),
    "maternalNotes" text,
    "milkProduction" character varying(20),
    "mastitisHistory" boolean DEFAULT false NOT NULL,
    "milkNotes" text,
    "recoveryPattern" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: AnimalBreedingProfile_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."AnimalBreedingProfile_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: AnimalBreedingProfile_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."AnimalBreedingProfile_id_seq" OWNED BY public."AnimalBreedingProfile".id;


--
-- Name: AnimalGenetics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AnimalGenetics" (
    id integer NOT NULL,
    "animalId" integer NOT NULL,
    "testProvider" character varying(255),
    "testDate" date,
    "testId" character varying(255),
    "coatColorData" jsonb,
    "healthGeneticsData" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "coatTypeData" jsonb,
    "eyeColorData" jsonb,
    "otherTraitsData" jsonb,
    "physicalTraitsData" jsonb,
    "breedComposition" jsonb,
    coi jsonb,
    "lifeStage" character varying(100),
    lineage jsonb,
    "mhcDiversity" jsonb,
    "predictedAdultWeight" jsonb,
    "performanceData" jsonb,
    "temperamentData" jsonb
);


--
-- Name: AnimalGenetics_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."AnimalGenetics_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: AnimalGenetics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."AnimalGenetics_id_seq" OWNED BY public."AnimalGenetics".id;


--
-- Name: AnimalIdentityLink; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AnimalIdentityLink" (
    id integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "animalId" integer NOT NULL,
    "identityId" integer NOT NULL,
    confidence double precision DEFAULT 1.0 NOT NULL,
    "matchedOn" text[],
    "autoMatched" boolean DEFAULT false NOT NULL,
    "confirmedAt" timestamp(3) without time zone,
    "confirmedByUser" text
);


--
-- Name: AnimalIdentityLink_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."AnimalIdentityLink_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: AnimalIdentityLink_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."AnimalIdentityLink_id_seq" OWNED BY public."AnimalIdentityLink".id;


--
-- Name: AnimalIncompatibility; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AnimalIncompatibility" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "profileId" integer NOT NULL,
    "incompatibleAnimalId" integer NOT NULL,
    reason character varying(500) NOT NULL,
    severity character varying(20) DEFAULT 'AVOID'::character varying NOT NULL,
    "recordedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "recordedBy" character varying(255)
);


--
-- Name: AnimalIncompatibility_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."AnimalIncompatibility_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: AnimalIncompatibility_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."AnimalIncompatibility_id_seq" OWNED BY public."AnimalIncompatibility".id;


--
-- Name: AnimalLinkRequest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AnimalLinkRequest" (
    id integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "requestingTenantId" integer NOT NULL,
    "requestingUserId" text NOT NULL,
    "sourceAnimalId" integer NOT NULL,
    "relationshipType" public."ParentType" NOT NULL,
    "targetAnimalId" integer,
    "targetGaid" text,
    "targetExchangeCode" text,
    "targetRegistryId" integer,
    "targetRegistryNum" text,
    "targetTenantId" integer,
    message text,
    status public."LinkRequestStatus" DEFAULT 'PENDING'::public."LinkRequestStatus" NOT NULL,
    "respondedAt" timestamp(3) without time zone,
    "responseMessage" text,
    "denialReason" text,
    "confirmedTargetAnimalId" integer
);


--
-- Name: AnimalLinkRequest_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."AnimalLinkRequest_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: AnimalLinkRequest_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."AnimalLinkRequest_id_seq" OWNED BY public."AnimalLinkRequest".id;


--
-- Name: AnimalMicrochipRegistration; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AnimalMicrochipRegistration" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "animalId" integer,
    "offspringId" integer,
    "microchipNumber" text NOT NULL,
    "registryId" integer NOT NULL,
    "registrationDate" timestamp(3) without time zone,
    "expirationDate" timestamp(3) without time zone,
    "accountNumber" text,
    "registeredToContactId" integer,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: AnimalMicrochipRegistration_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."AnimalMicrochipRegistration_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: AnimalMicrochipRegistration_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."AnimalMicrochipRegistration_id_seq" OWNED BY public."AnimalMicrochipRegistration".id;


--
-- Name: AnimalOwner; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AnimalOwner" (
    id integer NOT NULL,
    "animalId" integer NOT NULL,
    percent integer NOT NULL,
    "isPrimary" boolean DEFAULT false NOT NULL,
    "partyId" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "effectiveDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "endDate" timestamp(3) without time zone,
    "isPrimaryContact" boolean DEFAULT false NOT NULL,
    notes text,
    "receiveNotifications" boolean DEFAULT true NOT NULL,
    role public."OwnerRole" DEFAULT 'CO_OWNER'::public."OwnerRole" NOT NULL
);


--
-- Name: AnimalOwner_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."AnimalOwner_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: AnimalOwner_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."AnimalOwner_id_seq" OWNED BY public."AnimalOwner".id;


--
-- Name: AnimalOwnershipChange; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AnimalOwnershipChange" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "animalId" integer NOT NULL,
    kind public."OwnershipChangeKind" NOT NULL,
    "effectiveDate" timestamp(3) without time zone,
    "occurredAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "valueCents" integer,
    currency character varying(3),
    "fromOwners" jsonb NOT NULL,
    "toOwners" jsonb NOT NULL,
    "fromOwnerParties" jsonb,
    "toOwnerParties" jsonb,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: AnimalOwnershipChange_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."AnimalOwnershipChange_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: AnimalOwnershipChange_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."AnimalOwnershipChange_id_seq" OWNED BY public."AnimalOwnershipChange".id;


--
-- Name: AnimalPrivacySettings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AnimalPrivacySettings" (
    id integer NOT NULL,
    "animalId" integer NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "allowCrossTenantMatching" boolean DEFAULT true NOT NULL,
    "showName" boolean DEFAULT true NOT NULL,
    "showPhoto" boolean DEFAULT true NOT NULL,
    "showFullDob" boolean DEFAULT true NOT NULL,
    "showRegistryFull" boolean DEFAULT false NOT NULL,
    "showBreeder" boolean DEFAULT true NOT NULL,
    "allowInfoRequests" boolean DEFAULT true NOT NULL,
    "allowDirectContact" boolean DEFAULT false NOT NULL,
    "showCompetitionDetails" boolean DEFAULT false NOT NULL,
    "showCompetitions" boolean DEFAULT false NOT NULL,
    "showTitleDetails" boolean DEFAULT false NOT NULL,
    "showTitles" boolean DEFAULT true NOT NULL,
    "enableDocumentSharing" boolean DEFAULT false NOT NULL,
    "enableGeneticsSharing" boolean DEFAULT false NOT NULL,
    "enableHealthSharing" boolean DEFAULT false NOT NULL,
    "enableMediaSharing" boolean DEFAULT false NOT NULL,
    "showBreedingHistory" boolean DEFAULT false NOT NULL,
    "vaccinationVisibility" jsonb DEFAULT '{}'::jsonb
);


--
-- Name: AnimalPrivacySettings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."AnimalPrivacySettings_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: AnimalPrivacySettings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."AnimalPrivacySettings_id_seq" OWNED BY public."AnimalPrivacySettings".id;


--
-- Name: AnimalProgramMedia; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AnimalProgramMedia" (
    id integer NOT NULL,
    "programId" integer NOT NULL,
    type character varying(32) NOT NULL,
    url character varying(500) NOT NULL,
    caption text,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "isPrimary" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: AnimalProgramMedia_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."AnimalProgramMedia_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: AnimalProgramMedia_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."AnimalProgramMedia_id_seq" OWNED BY public."AnimalProgramMedia".id;


--
-- Name: AnimalProgramParticipant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AnimalProgramParticipant" (
    id integer NOT NULL,
    "programId" integer NOT NULL,
    "animalId" integer NOT NULL,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    listed boolean DEFAULT true NOT NULL,
    featured boolean DEFAULT false NOT NULL,
    "headlineOverride" character varying(120),
    "descriptionOverride" text,
    "dataDrawerOverride" jsonb,
    "contentOverride" jsonb,
    "priceModel" character varying(32),
    "priceCents" integer,
    "priceMinCents" integer,
    "priceMaxCents" integer,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "viewCount" integer DEFAULT 0 NOT NULL,
    "inquiryCount" integer DEFAULT 0 NOT NULL,
    "lastViewedAt" timestamp(3) without time zone,
    "lastInquiryAt" timestamp(3) without time zone,
    "addedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "bookingFeeOverride" integer,
    "bookingsClosed" boolean DEFAULT false NOT NULL,
    "bookingsReceived" integer DEFAULT 0 NOT NULL,
    "maxBookingsOverride" integer
);


--
-- Name: AnimalProgramParticipant_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."AnimalProgramParticipant_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: AnimalProgramParticipant_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."AnimalProgramParticipant_id_seq" OWNED BY public."AnimalProgramParticipant".id;


--
-- Name: mkt_listing_animal_program; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mkt_listing_animal_program (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    name character varying(100) NOT NULL,
    slug text NOT NULL,
    "templateType" character varying(32) NOT NULL,
    headline character varying(120),
    description text,
    "coverImageUrl" character varying(500),
    "dataDrawerConfig" jsonb NOT NULL,
    "programContent" jsonb,
    "defaultPriceModel" character varying(32) DEFAULT 'inquire'::character varying NOT NULL,
    "defaultPriceCents" integer,
    "defaultPriceMinCents" integer,
    "defaultPriceMaxCents" integer,
    listed boolean DEFAULT true NOT NULL,
    "publishedAt" timestamp(3) without time zone,
    "acceptInquiries" boolean DEFAULT true NOT NULL,
    "openWaitlist" boolean DEFAULT false NOT NULL,
    "viewCount" integer DEFAULT 0 NOT NULL,
    "inquiryCount" integer DEFAULT 0 NOT NULL,
    "lastViewedAt" timestamp(3) without time zone,
    "lastInquiryAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    status public."MarketplaceListingStatus" DEFAULT 'DRAFT'::public."MarketplaceListingStatus" NOT NULL,
    "breedingMethods" text[] DEFAULT ARRAY[]::text[],
    "defaultBookingFeeCents" integer,
    "defaultGuaranteeType" public."BreedingGuaranteeType",
    "defaultMaxBookingsPerAnimal" integer,
    "healthCertRequired" boolean DEFAULT false NOT NULL,
    "requiredTests" text[] DEFAULT ARRAY[]::text[],
    "seasonEnd" timestamp(3) without time zone,
    "seasonName" character varying(100),
    "seasonStart" timestamp(3) without time zone,
    "locationCity" character varying(100),
    "locationCountry" character varying(2),
    "locationRegion" character varying(100),
    "locationZip" character varying(20)
);


--
-- Name: AnimalProgram_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."AnimalProgram_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: AnimalProgram_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."AnimalProgram_id_seq" OWNED BY public.mkt_listing_animal_program.id;


--
-- Name: AnimalRegistryIdentifier; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AnimalRegistryIdentifier" (
    id integer NOT NULL,
    "animalId" integer NOT NULL,
    "registryId" integer NOT NULL,
    identifier text NOT NULL,
    "registrarOfRecord" text,
    "issuedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: AnimalRegistryIdentifier_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."AnimalRegistryIdentifier_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: AnimalRegistryIdentifier_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."AnimalRegistryIdentifier_id_seq" OWNED BY public."AnimalRegistryIdentifier".id;


--
-- Name: AnimalTitle; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AnimalTitle" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "animalId" integer NOT NULL,
    "titleDefinitionId" integer NOT NULL,
    "dateEarned" timestamp(3) without time zone,
    status public."TitleStatus" DEFAULT 'EARNED'::public."TitleStatus" NOT NULL,
    "pointsEarned" double precision,
    "majorWins" integer,
    verified boolean DEFAULT false NOT NULL,
    "verifiedAt" timestamp(3) without time zone,
    "verifiedBy" text,
    "registryRef" text,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "eventLocation" text,
    "eventName" text,
    "handlerName" text,
    "isPublic" boolean DEFAULT false NOT NULL
);


--
-- Name: AnimalTitleDocument; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AnimalTitleDocument" (
    id integer NOT NULL,
    "animalTitleId" integer NOT NULL,
    "documentId" integer NOT NULL
);


--
-- Name: AnimalTitleDocument_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."AnimalTitleDocument_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: AnimalTitleDocument_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."AnimalTitleDocument_id_seq" OWNED BY public."AnimalTitleDocument".id;


--
-- Name: AnimalTitle_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."AnimalTitle_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: AnimalTitle_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."AnimalTitle_id_seq" OWNED BY public."AnimalTitle".id;


--
-- Name: AnimalTraitEntry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AnimalTraitEntry" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "animalId" integer NOT NULL,
    "traitDefinitionId" integer NOT NULL,
    "recordedAt" timestamp(3) without time zone NOT NULL,
    data jsonb NOT NULL,
    "performedBy" character varying(255),
    location character varying(255),
    notes text,
    "documentId" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: AnimalTraitEntry_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."AnimalTraitEntry_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: AnimalTraitEntry_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."AnimalTraitEntry_id_seq" OWNED BY public."AnimalTraitEntry".id;


--
-- Name: AnimalTraitValue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AnimalTraitValue" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "animalId" integer NOT NULL,
    "traitDefinitionId" integer NOT NULL,
    "valueBoolean" boolean,
    "valueNumber" double precision,
    "valueText" text,
    "valueDate" timestamp(3) without time zone,
    "valueJson" jsonb,
    status public."TraitStatus",
    "performedAt" timestamp(3) without time zone,
    source public."TraitSource",
    verified boolean DEFAULT false NOT NULL,
    "verifiedAt" timestamp(3) without time zone,
    "marketplaceVisible" boolean,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "networkVisible" boolean
);


--
-- Name: AnimalTraitValueDocument; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AnimalTraitValueDocument" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "animalId" integer NOT NULL,
    "animalTraitValueId" integer NOT NULL,
    "documentId" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: AnimalTraitValueDocument_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."AnimalTraitValueDocument_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: AnimalTraitValueDocument_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."AnimalTraitValueDocument_id_seq" OWNED BY public."AnimalTraitValueDocument".id;


--
-- Name: AnimalTraitValue_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."AnimalTraitValue_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: AnimalTraitValue_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."AnimalTraitValue_id_seq" OWNED BY public."AnimalTraitValue".id;


--
-- Name: Animal_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Animal_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Animal_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Animal_id_seq" OWNED BY public."Animal".id;


--
-- Name: AssessmentResult; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AssessmentResult" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "assignmentId" integer NOT NULL,
    "offspringId" integer NOT NULL,
    "assessmentType" public."AssessmentType" NOT NULL,
    scores jsonb NOT NULL,
    notes text,
    "assessedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "assessedBy" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: AssessmentResult_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."AssessmentResult_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: AssessmentResult_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."AssessmentResult_id_seq" OWNED BY public."AssessmentResult".id;


--
-- Name: AssignmentOffspringOverride; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AssignmentOffspringOverride" (
    id integer NOT NULL,
    "assignmentId" integer NOT NULL,
    "offspringId" integer NOT NULL,
    "customStartDate" timestamp(3) without time zone,
    "skipToStage" text,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: AssignmentOffspringOverride_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."AssignmentOffspringOverride_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: AssignmentOffspringOverride_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."AssignmentOffspringOverride_id_seq" OWNED BY public."AssignmentOffspringOverride".id;


--
-- Name: Attachment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Attachment" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "planId" integer,
    "animalId" integer,
    "litterId" integer,
    "offspringGroupId" integer,
    "offspringId" integer,
    "attachmentPartyId" integer,
    "invoiceId" integer,
    "paymentId" integer,
    "expenseId" integer,
    kind text NOT NULL,
    "storageProvider" text NOT NULL,
    "storageKey" text NOT NULL,
    filename text NOT NULL,
    mime text NOT NULL,
    bytes integer NOT NULL,
    "createdByUserId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Attachment_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Attachment_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Attachment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Attachment_id_seq" OWNED BY public."Attachment".id;


--
-- Name: AuditEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AuditEvent" (
    id integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "requestId" character varying(64),
    ip character varying(45),
    "userAgent" text,
    "userId" character varying(64),
    surface public."AuditSurface" NOT NULL,
    "actorContext" public."AuditActorContext",
    "tenantId" integer,
    action character varying(64) NOT NULL,
    outcome public."AuditOutcome" NOT NULL,
    "detailJson" jsonb
);


--
-- Name: AuditEvent_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."AuditEvent_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: AuditEvent_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."AuditEvent_id_seq" OWNED BY public."AuditEvent".id;


--
-- Name: AutoReplyLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AutoReplyLog" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    channel public."TemplateChannel" NOT NULL,
    "partyId" integer NOT NULL,
    "threadId" integer,
    "ruleId" integer,
    "templateId" integer,
    reason text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    status public."AutoReplyLogStatus" NOT NULL
);


--
-- Name: AutoReplyLog_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."AutoReplyLog_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: AutoReplyLog_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."AutoReplyLog_id_seq" OWNED BY public."AutoReplyLog".id;


--
-- Name: AutoReplyRule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AutoReplyRule" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    channel public."TemplateChannel" NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    "templateId" integer NOT NULL,
    "triggerType" public."AutoReplyTriggerType" NOT NULL,
    "cooldownMinutes" integer DEFAULT 60 NOT NULL,
    "businessHoursJson" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "createdByPartyId" integer,
    description text,
    "executionCount" integer DEFAULT 0 NOT NULL,
    "keywordConfigJson" jsonb,
    "lastExecutedAt" timestamp(3) without time zone,
    name text NOT NULL,
    status public."AutoReplyRuleStatus" DEFAULT 'active'::public."AutoReplyRuleStatus" NOT NULL,
    "timeBasedConfigJson" jsonb
);


--
-- Name: AutoReplyRule_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."AutoReplyRule_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: AutoReplyRule_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."AutoReplyRule_id_seq" OWNED BY public."AutoReplyRule".id;


--
-- Name: BillingAccount; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BillingAccount" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    provider text,
    "subscriptionId" text,
    plan text,
    status text,
    "currentPeriodEnd" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "addressLine1" text,
    "addressLine2" text,
    "billingEmail" text,
    city text,
    "companyName" text,
    country character varying(2),
    "postalCode" text,
    state text,
    "stripeCustomerId" text,
    "taxId" text
);


--
-- Name: BillingAccount_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."BillingAccount_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: BillingAccount_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."BillingAccount_id_seq" OWNED BY public."BillingAccount".id;


--
-- Name: BlockedEmail; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BlockedEmail" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "fromEmail" character varying(255) NOT NULL,
    "toEmail" character varying(255) NOT NULL,
    subject character varying(500) NOT NULL,
    "bodySnippet" text,
    "resendEmailId" character varying(100),
    reason character varying(50) NOT NULL,
    details jsonb,
    "blockedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: BlockedEmail_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."BlockedEmail_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: BlockedEmail_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."BlockedEmail_id_seq" OWNED BY public."BlockedEmail".id;


--
-- Name: Breed; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Breed" (
    id integer NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    species public."Species" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: BreedRegistryLink; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BreedRegistryLink" (
    "breedId" integer NOT NULL,
    "registryId" integer NOT NULL,
    "statusText" text,
    "registryRef" text,
    url text,
    "primary" boolean,
    since integer,
    notes text,
    "proofUrl" text
);


--
-- Name: Breed_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Breed_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Breed_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Breed_id_seq" OWNED BY public."Breed".id;


--
-- Name: BreederProfile; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BreederProfile" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "registryAffiliations" text[],
    "primaryRegistry" text,
    "breedingLineTypes" text[],
    "breedingPhilosophy" text,
    "requiresHealthTesting" boolean DEFAULT false NOT NULL,
    "requiresContract" boolean DEFAULT false NOT NULL,
    "requiredTests" text[],
    "excludedRegistries" text[],
    "excludedLineTypes" text[],
    "excludedAttributes" text[],
    "exclusionNotes" text,
    "showRegistryAffiliations" boolean DEFAULT true NOT NULL,
    "showBreedingLineTypes" boolean DEFAULT true NOT NULL,
    "showRequirements" boolean DEFAULT true NOT NULL,
    "publicBio" text,
    "websiteUrl" text,
    "socialLinks" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: BreederProfile_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."BreederProfile_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: BreederProfile_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."BreederProfile_id_seq" OWNED BY public."BreederProfile".id;


--
-- Name: BreederReport; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BreederReport" (
    id integer NOT NULL,
    "breederTenantId" integer NOT NULL,
    "reporterUserId" character varying(36) NOT NULL,
    reason public."BreederReportReason" NOT NULL,
    severity public."BreederReportSeverity" NOT NULL,
    description text,
    status public."BreederReportStatus" DEFAULT 'PENDING'::public."BreederReportStatus" NOT NULL,
    "adminNotes" text,
    "reviewedByUserId" text,
    "reviewedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: BreederReportFlag; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BreederReportFlag" (
    id integer NOT NULL,
    "breederTenantId" integer NOT NULL,
    "totalReports" integer DEFAULT 0 NOT NULL,
    "pendingReports" integer DEFAULT 0 NOT NULL,
    "lightReports" integer DEFAULT 0 NOT NULL,
    "mediumReports" integer DEFAULT 0 NOT NULL,
    "heavyReports" integer DEFAULT 0 NOT NULL,
    "flaggedAt" timestamp(3) without time zone,
    "flagReason" text,
    "warningIssuedAt" timestamp(3) without time zone,
    "warningNote" text,
    "marketplaceSuspendedAt" timestamp(3) without time zone,
    "suspendedReason" text,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: BreederReportFlag_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."BreederReportFlag_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: BreederReportFlag_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."BreederReportFlag_id_seq" OWNED BY public."BreederReportFlag".id;


--
-- Name: BreederReport_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."BreederReport_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: BreederReport_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."BreederReport_id_seq" OWNED BY public."BreederReport".id;


--
-- Name: BreedingAttempt; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BreedingAttempt" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "planId" integer,
    method public."BreedingMethod" NOT NULL,
    "attemptAt" timestamp(3) without time zone,
    "windowStart" timestamp(3) without time zone,
    "windowEnd" timestamp(3) without time zone,
    "studOwnerPartyId" integer,
    "semenBatchId" integer,
    success boolean,
    notes text,
    data jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "damId" integer,
    "sireId" integer,
    "agreedFeeCents" integer,
    "feePaidCents" integer DEFAULT 0,
    "guaranteeExpiresAt" timestamp(3) without time zone,
    "guaranteeReason" text,
    "guaranteeResolution" public."GuaranteeResolution",
    "guaranteeTriggered" boolean DEFAULT false NOT NULL,
    "guaranteeTriggeredAt" timestamp(3) without time zone,
    "guaranteeType" public."BreedingGuaranteeType",
    "returnBreedingExpiresAt" timestamp(3) without time zone,
    "returnBreedingGranted" boolean DEFAULT false NOT NULL,
    "returnBreedingUsedAt" timestamp(3) without time zone,
    location character varying(255)
);


--
-- Name: BreedingAttempt_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."BreedingAttempt_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: BreedingAttempt_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."BreedingAttempt_id_seq" OWNED BY public."BreedingAttempt".id;


--
-- Name: BreedingBooking; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BreedingBooking" (
    id integer NOT NULL,
    "bookingNumber" text NOT NULL,
    "sourceListingId" integer,
    "sourceInquiryId" integer,
    "offeringTenantId" integer NOT NULL,
    "offeringAnimalId" integer NOT NULL,
    "seekingPartyId" integer NOT NULL,
    "seekingTenantId" integer,
    "seekingAnimalId" integer,
    "externalAnimalName" text,
    "externalAnimalReg" text,
    "externalAnimalBreed" text,
    "externalAnimalSex" text,
    species public."Species" NOT NULL,
    "bookingType" public."BreedingBookingType" NOT NULL,
    "preferredMethod" text,
    "preferredDateStart" timestamp(3) without time zone,
    "preferredDateEnd" timestamp(3) without time zone,
    "scheduledDate" timestamp(3) without time zone,
    "shippingRequired" boolean DEFAULT false NOT NULL,
    "shippingAddress" text,
    "agreedFeeCents" integer NOT NULL,
    "depositCents" integer DEFAULT 0 NOT NULL,
    "totalPaidCents" integer DEFAULT 0 NOT NULL,
    "feeDirection" public."BreedingListingFeeDirection" NOT NULL,
    status public."BreedingBookingStatus" DEFAULT 'INQUIRY'::public."BreedingBookingStatus" NOT NULL,
    "statusChangedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    requirements jsonb,
    "requirementsConfig" text,
    "guaranteeType" text,
    "breedingPlanId" integer,
    notes text,
    "internalNotes" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "cancelledAt" timestamp(3) without time zone,
    "cancellationReason" text,
    "outcomeRecordedAt" timestamp(3) without time zone,
    "outcomeType" character varying(50),
    "semenUsageId" integer
);


--
-- Name: BreedingBooking_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."BreedingBooking_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: BreedingBooking_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."BreedingBooking_id_seq" OWNED BY public."BreedingBooking".id;


--
-- Name: BreedingDataAgreement; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BreedingDataAgreement" (
    id text NOT NULL,
    "breedingPlanId" integer NOT NULL,
    "animalAccessId" integer NOT NULL,
    "requestingTenantId" integer NOT NULL,
    "approvingTenantId" integer NOT NULL,
    "animalRole" text NOT NULL,
    status public."BreedingAgreementStatus" DEFAULT 'PENDING'::public."BreedingAgreementStatus" NOT NULL,
    "requestedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "approvedAt" timestamp(3) without time zone,
    "rejectedAt" timestamp(3) without time zone,
    "requestMessage" text,
    "responseMessage" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: BreedingDiscoveryProgram; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BreedingDiscoveryProgram" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "programNumber" text NOT NULL,
    name text NOT NULL,
    description text,
    species public."Species" NOT NULL,
    "programType" text NOT NULL,
    "defaultBreedingMethods" text[],
    "defaultGuaranteeType" text,
    "defaultGuaranteeTerms" text,
    "defaultRequiresHealthTesting" boolean DEFAULT false NOT NULL,
    "defaultRequiredTests" text[],
    "defaultRequiresContract" boolean DEFAULT false NOT NULL,
    "publicEnabled" boolean DEFAULT false NOT NULL,
    "publicSlug" text,
    "publicEnabledAt" timestamp(3) without time zone,
    "publicHeadline" text,
    "publicDescription" text,
    media text[],
    "locationCity" text,
    "locationState" text,
    "locationCountry" text,
    status public."BreedingProgramStatus" DEFAULT 'ACTIVE'::public."BreedingProgramStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: BreedingDiscoveryProgram_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."BreedingDiscoveryProgram_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: BreedingDiscoveryProgram_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."BreedingDiscoveryProgram_id_seq" OWNED BY public."BreedingDiscoveryProgram".id;


--
-- Name: BreedingEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BreedingEvent" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "animalId" integer NOT NULL,
    "eventType" character varying(50) NOT NULL,
    "occurredAt" timestamp(3) without time zone NOT NULL,
    outcome character varying(30),
    "breedingPlanId" integer,
    "partnerAnimalId" integer,
    title character varying(200),
    description text,
    "serviceType" character varying(20),
    "tieDurationMinutes" integer,
    "totalBorn" integer,
    "bornAlive" integer,
    stillborn integer,
    "deliveryType" character varying(20),
    "testType" character varying(100),
    "testResult" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdBy" character varying(255),
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: BreedingEvent_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."BreedingEvent_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: BreedingEvent_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."BreedingEvent_id_seq" OWNED BY public."BreedingEvent".id;


--
-- Name: BreedingGroup; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BreedingGroup" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "organizationId" integer,
    "programId" integer,
    name text NOT NULL,
    species public."Species" NOT NULL,
    "breedText" text,
    "seasonLabel" text,
    notes text,
    "sireId" integer NOT NULL,
    "exposureStartDate" timestamp(3) without time zone NOT NULL,
    "exposureEndDate" timestamp(3) without time zone,
    status public."BreedingGroupStatus" DEFAULT 'ACTIVE'::public."BreedingGroupStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone
);


--
-- Name: BreedingGroupMember; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BreedingGroupMember" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "groupId" integer NOT NULL,
    "damId" integer NOT NULL,
    "memberStatus" public."BreedingGroupMemberStatus" DEFAULT 'EXPOSED'::public."BreedingGroupMemberStatus" NOT NULL,
    "exposedAt" timestamp(3) without time zone,
    "removedAt" timestamp(3) without time zone,
    "pregnancyConfirmedAt" timestamp(3) without time zone,
    "pregnancyCheckMethod" public."PregnancyCheckMethod",
    "breedingPlanId" integer,
    "expectedBirthStart" timestamp(3) without time zone,
    "expectedBirthEnd" timestamp(3) without time zone,
    "actualBirthDate" timestamp(3) without time zone,
    "offspringCount" integer,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "birthNotes" text,
    "liveCount" integer,
    "stillbornCount" integer
);


--
-- Name: BreedingGroupMember_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."BreedingGroupMember_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: BreedingGroupMember_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."BreedingGroupMember_id_seq" OWNED BY public."BreedingGroupMember".id;


--
-- Name: BreedingGroup_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."BreedingGroup_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: BreedingGroup_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."BreedingGroup_id_seq" OWNED BY public."BreedingGroup".id;


--
-- Name: BreedingInquiry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BreedingInquiry" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "listingId" integer NOT NULL,
    "inquirerName" text NOT NULL,
    "inquirerEmail" text NOT NULL,
    "inquirerPhone" text,
    "inquirerType" text NOT NULL,
    "isBreeder" boolean DEFAULT false NOT NULL,
    message text NOT NULL,
    "interestedInMethod" text,
    status public."BreedingInquiryStatus" DEFAULT 'NEW'::public."BreedingInquiryStatus" NOT NULL,
    "readAt" timestamp(3) without time zone,
    "repliedAt" timestamp(3) without time zone,
    "convertedToUserId" integer,
    "convertedToBookingId" integer,
    "convertedAt" timestamp(3) without time zone,
    "referrerUrl" text,
    "utmSource" text,
    "utmMedium" text,
    "utmCampaign" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: BreedingInquiry_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."BreedingInquiry_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: BreedingInquiry_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."BreedingInquiry_id_seq" OWNED BY public."BreedingInquiry".id;


--
-- Name: BreedingListing; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BreedingListing" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "listingNumber" text NOT NULL,
    "animalId" integer NOT NULL,
    "programId" integer,
    species public."Species" NOT NULL,
    breed text,
    sex public."Sex" NOT NULL,
    intent public."BreedingListingIntent" NOT NULL,
    headline text NOT NULL,
    description text,
    media text[],
    "feeCents" integer,
    "feeDirection" public."BreedingListingFeeDirection",
    "feeNotes" text,
    "availableFrom" timestamp(3) without time zone,
    "availableTo" timestamp(3) without time zone,
    "seasonName" text,
    "breedingMethods" text[],
    "maxBookings" integer,
    "currentBookings" integer DEFAULT 0 NOT NULL,
    "guaranteeType" text,
    "guaranteeTerms" text,
    "requiresHealthTesting" boolean DEFAULT false NOT NULL,
    "requiredTests" text[],
    "requiresContract" boolean DEFAULT false NOT NULL,
    "additionalRequirements" text,
    status public."BreedingListingStatus" DEFAULT 'DRAFT'::public."BreedingListingStatus" NOT NULL,
    "publishedAt" timestamp(3) without time zone,
    "pausedAt" timestamp(3) without time zone,
    "closedAt" timestamp(3) without time zone,
    "closedReason" text,
    "publicEnabled" boolean DEFAULT false NOT NULL,
    "publicSlug" text,
    "publicEnabledAt" timestamp(3) without time zone,
    "publicShowPedigree" boolean DEFAULT true NOT NULL,
    "publicPedigreeDepth" integer DEFAULT 2 NOT NULL,
    "publicShowTitles" boolean DEFAULT true NOT NULL,
    "publicShowHealthTesting" boolean DEFAULT true NOT NULL,
    "publicShowLineType" boolean DEFAULT true NOT NULL,
    "publicShowProducingStats" boolean DEFAULT false NOT NULL,
    "publicShowBreederName" boolean DEFAULT true NOT NULL,
    "publicShowBreederLocation" boolean DEFAULT true NOT NULL,
    "publicShowFee" boolean DEFAULT true NOT NULL,
    "metaTitle" text,
    "metaDescription" text,
    "acceptInquiries" boolean DEFAULT true NOT NULL,
    "inquiryEmail" text,
    "inquiryPhone" text,
    "inquiryInstructions" text,
    "viewCount" integer DEFAULT 0 NOT NULL,
    "inquiryCount" integer DEFAULT 0 NOT NULL,
    "bookingCount" integer DEFAULT 0 NOT NULL,
    "locationCity" text,
    "locationState" text,
    "locationCountry" text,
    "locationLat" double precision,
    "locationLng" double precision,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "createdBy" integer
);


--
-- Name: BreedingListing_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."BreedingListing_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: BreedingListing_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."BreedingListing_id_seq" OWNED BY public."BreedingListing".id;


--
-- Name: BreedingMilestone; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BreedingMilestone" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "breedingPlanId" integer NOT NULL,
    "milestoneType" public."MilestoneType" NOT NULL,
    "scheduledDate" timestamp(3) without time zone NOT NULL,
    "completedDate" timestamp(3) without time zone,
    "isCompleted" boolean DEFAULT false NOT NULL,
    "notificationSent" boolean DEFAULT false NOT NULL,
    "notificationSentAt" timestamp(3) without time zone,
    notes text,
    "vetAppointmentId" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: BreedingMilestone_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."BreedingMilestone_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: BreedingMilestone_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."BreedingMilestone_id_seq" OWNED BY public."BreedingMilestone".id;


--
-- Name: BreedingPlan; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BreedingPlan" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "organizationId" integer,
    code text,
    name text NOT NULL,
    nickname text,
    species public."Species" NOT NULL,
    "breedText" text,
    "damId" integer,
    "sireId" integer,
    "lockedCycleKey" text,
    "lockedCycleStart" timestamp(3) without time zone,
    "lockedOvulationDate" timestamp(3) without time zone,
    "lockedDueDate" timestamp(3) without time zone,
    "lockedPlacementStartDate" timestamp(3) without time zone,
    "expectedCycleStart" timestamp(3) without time zone,
    "expectedHormoneTestingStart" timestamp(3) without time zone,
    "expectedBreedDate" timestamp(3) without time zone,
    "expectedBirthDate" timestamp(3) without time zone,
    "expectedWeaned" timestamp(3) without time zone,
    "expectedPlacementStart" timestamp(3) without time zone,
    "expectedPlacementCompleted" timestamp(3) without time zone,
    "cycleStartDateActual" timestamp(3) without time zone,
    "hormoneTestingStartDateActual" timestamp(3) without time zone,
    "breedDateActual" timestamp(3) without time zone,
    "birthDateActual" timestamp(3) without time zone,
    "weanedDateActual" timestamp(3) without time zone,
    "placementStartDateActual" timestamp(3) without time zone,
    "placementCompletedDateActual" timestamp(3) without time zone,
    "completedDateActual" timestamp(3) without time zone,
    status public."BreedingPlanStatus" DEFAULT 'PLANNING'::public."BreedingPlanStatus" NOT NULL,
    notes text,
    "committedAt" timestamp(3) without time zone,
    "committedByUserId" text,
    "depositsCommittedCents" integer,
    "depositsPaidCents" integer,
    "depositRiskScore" integer,
    archived boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "programId" integer,
    "deletedAt" timestamp(3) without time zone,
    "actualOvulationOffset" integer,
    "cycleStartConfidence" public."ConfidenceLevel",
    "cycleStartObserved" timestamp(3) without time zone,
    "cycleStartSource" public."DataSource",
    "dateConfidenceLevel" public."ConfidenceLevel" DEFAULT 'MEDIUM'::public."ConfidenceLevel",
    "dateSourceNotes" text,
    "expectedOvulationOffset" integer,
    "ovulationConfidence" public."ConfidenceLevel",
    "ovulationConfirmed" timestamp(3) without time zone,
    "ovulationConfirmedMethod" public."OvulationMethod",
    "ovulationTestResultId" integer,
    "primaryAnchor" public."AnchorType" DEFAULT 'CYCLE_START'::public."AnchorType" NOT NULL,
    "reproAnchorMode" public."ReproAnchorMode" DEFAULT 'CYCLE_START'::public."ReproAnchorMode" NOT NULL,
    "varianceFromExpected" integer,
    "breedDateUnknown" boolean DEFAULT false NOT NULL,
    "cycleStartDateUnknown" boolean DEFAULT false NOT NULL,
    "isCommittedIntent" boolean DEFAULT false NOT NULL,
    "ovulationDateUnknown" boolean DEFAULT false NOT NULL,
    "statusBeforeHold" public."BreedingPlanStatus",
    "statusReason" text,
    "depositOverrideAmountCents" integer,
    "depositOverrideRequired" boolean,
    "expectedLitterSize" integer,
    "archiveReason" text,
    "countBorn" integer,
    "countLive" integer,
    "countStillborn" integer,
    "countMale" integer,
    "countFemale" integer,
    "countWeaned" integer,
    "countPlaced" integer,
    "listingSlug" text,
    "listingTitle" text,
    "listingDescription" text,
    "marketplaceDefaultPriceCents" integer,
    "marketplaceStatus" text DEFAULT 'DRAFT'::text,
    "depositRequired" boolean DEFAULT false,
    "depositAmountCents" integer,
    "coverImageUrl" text,
    "themeName" text,
    "placementSchedulingPolicy" jsonb
);


--
-- Name: BreedingPlanBuyer; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BreedingPlanBuyer" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "planId" integer NOT NULL,
    "waitlistEntryId" integer,
    "partyId" integer,
    stage public."BreedingPlanBuyerStage" DEFAULT 'POSSIBLE_MATCH'::public."BreedingPlanBuyerStage" NOT NULL,
    "matchScore" integer,
    "matchReasons" jsonb,
    "assignedAt" timestamp(3) without time zone,
    "assignedByPartyId" integer,
    priority integer,
    "offspringId" integer,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "buyerId" integer,
    "placementRank" integer,
    "optedOutAt" timestamp with time zone,
    "optedOutReason" text,
    "optedOutBy" character varying(20),
    "depositDisposition" character varying(30)
);


--
-- Name: BreedingPlanBuyer_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."BreedingPlanBuyer_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: BreedingPlanBuyer_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."BreedingPlanBuyer_id_seq" OWNED BY public."BreedingPlanBuyer".id;


--
-- Name: BreedingPlanEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BreedingPlanEvent" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "planId" integer NOT NULL,
    type text NOT NULL,
    "occurredAt" timestamp(3) without time zone NOT NULL,
    label text,
    notes text,
    data jsonb,
    "recordedByUserId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: BreedingPlanEvent_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."BreedingPlanEvent_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: BreedingPlanEvent_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."BreedingPlanEvent_id_seq" OWNED BY public."BreedingPlanEvent".id;


--
-- Name: BreedingPlanTempLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BreedingPlanTempLog" (
    id integer NOT NULL,
    "planId" integer NOT NULL,
    "tenantId" integer NOT NULL,
    "recordedAt" timestamp(3) with time zone NOT NULL,
    "temperatureF" numeric(5,2) NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: BreedingPlanTempLog_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."BreedingPlanTempLog_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: BreedingPlanTempLog_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."BreedingPlanTempLog_id_seq" OWNED BY public."BreedingPlanTempLog".id;


--
-- Name: BreedingPlan_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."BreedingPlan_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: BreedingPlan_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."BreedingPlan_id_seq" OWNED BY public."BreedingPlan".id;


--
-- Name: BreedingProgramInquiry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BreedingProgramInquiry" (
    id integer NOT NULL,
    "programId" integer NOT NULL,
    "tenantId" integer NOT NULL,
    "buyerName" text NOT NULL,
    "buyerEmail" text NOT NULL,
    "buyerPhone" text,
    subject text NOT NULL,
    message text NOT NULL,
    "interestedIn" text,
    "priceRange" text,
    timeline text,
    status public."InquiryStatus" DEFAULT 'NEW'::public."InquiryStatus" NOT NULL,
    "assignedToUserId" text,
    responded boolean DEFAULT false NOT NULL,
    "respondedAt" timestamp(3) without time zone,
    notes text,
    source text,
    "utmSource" text,
    "utmMedium" text,
    "utmCampaign" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: BreedingProgramInquiry_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."BreedingProgramInquiry_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: BreedingProgramInquiry_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."BreedingProgramInquiry_id_seq" OWNED BY public."BreedingProgramInquiry".id;


--
-- Name: BreedingProgramMedia; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BreedingProgramMedia" (
    id integer NOT NULL,
    "programId" integer NOT NULL,
    "tenantId" integer NOT NULL,
    "assetUrl" text NOT NULL,
    caption text,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "isPublic" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: BreedingProgramMedia_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."BreedingProgramMedia_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: BreedingProgramMedia_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."BreedingProgramMedia_id_seq" OWNED BY public."BreedingProgramMedia".id;


--
-- Name: BreedingProgramRule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BreedingProgramRule" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    category public."BreedingRuleCategory" NOT NULL,
    "ruleType" character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    enabled boolean DEFAULT true NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    level public."BreedingRuleLevel" NOT NULL,
    "levelId" character varying(50) NOT NULL,
    "inheritsFromId" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: BreedingProgramRuleExecution; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BreedingProgramRuleExecution" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "ruleId" integer NOT NULL,
    "triggeredBy" character varying(50) NOT NULL,
    "entityType" character varying(20) NOT NULL,
    "entityId" integer NOT NULL,
    success boolean NOT NULL,
    action character varying(100),
    changes jsonb,
    error text,
    "executedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: BreedingProgramRuleExecution_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."BreedingProgramRuleExecution_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: BreedingProgramRuleExecution_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."BreedingProgramRuleExecution_id_seq" OWNED BY public."BreedingProgramRuleExecution".id;


--
-- Name: BreedingProgramRule_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."BreedingProgramRule_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: BreedingProgramRule_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."BreedingProgramRule_id_seq" OWNED BY public."BreedingProgramRule".id;


--
-- Name: mkt_listing_breeding_program; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mkt_listing_breeding_program (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    description text,
    species public."Species" NOT NULL,
    "breedText" text,
    "acceptInquiries" boolean DEFAULT true NOT NULL,
    "openWaitlist" boolean DEFAULT false NOT NULL,
    "acceptReservations" boolean DEFAULT false NOT NULL,
    "pricingTiers" jsonb,
    "whatsIncluded" text,
    "typicalWaitTime" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "publishedAt" timestamp(3) without time zone,
    "breedId" integer,
    "comingSoon" boolean DEFAULT false NOT NULL,
    "coverImageUrl" text,
    "programStory" text,
    "showCoverImage" boolean DEFAULT true NOT NULL,
    "showWaitTime" boolean DEFAULT true NOT NULL,
    "showWhatsIncluded" boolean DEFAULT true NOT NULL,
    status public."MarketplaceListingStatus" DEFAULT 'DRAFT'::public."MarketplaceListingStatus" NOT NULL,
    "comingSoonWeeksThreshold" integer DEFAULT 8 NOT NULL,
    "offspringDisplayMode" text DEFAULT 'curated'::text NOT NULL,
    "showOffspringPhotos" boolean DEFAULT true NOT NULL,
    "showParentPhotos" boolean DEFAULT true NOT NULL,
    "showPricing" boolean DEFAULT true NOT NULL
);


--
-- Name: BreedingProgram_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."BreedingProgram_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: BreedingProgram_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."BreedingProgram_id_seq" OWNED BY public.mkt_listing_breeding_program.id;


--
-- Name: Buyer; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Buyer" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "partyId" integer NOT NULL,
    status public."BuyerStatus" DEFAULT 'ACTIVE'::public."BuyerStatus" NOT NULL,
    source character varying(100),
    budget numeric(12,2),
    "budgetCurrency" character(3) DEFAULT 'USD'::bpchar NOT NULL,
    notes text,
    "preferredBreeds" text[],
    "preferredUses" text[],
    "preferredAgeMin" integer,
    "preferredAgeMax" integer,
    "preferredSex" public."Sex",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "archivedAt" timestamp(3) without time zone
);


--
-- Name: BuyerEmailTemplate; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BuyerEmailTemplate" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    name character varying(100) NOT NULL,
    subject character varying(255) NOT NULL,
    "bodyHtml" text NOT NULL,
    "bodyText" text NOT NULL,
    category public."BuyerEmailTemplateCategory" DEFAULT 'GENERAL'::public."BuyerEmailTemplateCategory" NOT NULL,
    "useCount" integer DEFAULT 0 NOT NULL,
    "lastUsedAt" timestamp(3) without time zone,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: BuyerEmailTemplate_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."BuyerEmailTemplate_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: BuyerEmailTemplate_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."BuyerEmailTemplate_id_seq" OWNED BY public."BuyerEmailTemplate".id;


--
-- Name: BuyerInterest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BuyerInterest" (
    id integer NOT NULL,
    "buyerId" integer NOT NULL,
    "animalId" integer NOT NULL,
    level public."InterestLevel" DEFAULT 'INTERESTED'::public."InterestLevel" NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: BuyerInterest_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."BuyerInterest_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: BuyerInterest_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."BuyerInterest_id_seq" OWNED BY public."BuyerInterest".id;


--
-- Name: BuyerTask; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BuyerTask" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    "taskType" public."BuyerTaskType" DEFAULT 'FOLLOW_UP'::public."BuyerTaskType" NOT NULL,
    priority public."BuyerTaskPriority" DEFAULT 'MEDIUM'::public."BuyerTaskPriority" NOT NULL,
    status public."BuyerTaskStatus" DEFAULT 'PENDING'::public."BuyerTaskStatus" NOT NULL,
    "dueAt" timestamp(3) without time zone,
    "reminderAt" timestamp(3) without time zone,
    "buyerId" integer,
    "dealId" integer,
    "animalId" integer,
    "assignedToUserId" text,
    "completedAt" timestamp(3) without time zone,
    "completedById" text,
    "isAutoGenerated" boolean DEFAULT false NOT NULL,
    "automationRule" character varying(100),
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: BuyerTask_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."BuyerTask_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: BuyerTask_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."BuyerTask_id_seq" OWNED BY public."BuyerTask".id;


--
-- Name: Buyer_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Buyer_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Buyer_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Buyer_id_seq" OWNED BY public."Buyer".id;


--
-- Name: Campaign; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Campaign" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "offspringGroupId" integer,
    name text NOT NULL,
    channel public."CampaignChannel" NOT NULL,
    "startedAt" timestamp(3) without time zone,
    "endedAt" timestamp(3) without time zone,
    "budgetCents" integer,
    "spendCents" integer,
    impressions integer,
    clicks integer,
    inquiries integer,
    reservations integer,
    conversions integer,
    "utmSource" text,
    "utmMedium" text,
    "utmCampaign" text,
    notes text,
    data jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: CampaignAttribution; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CampaignAttribution" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "campaignId" integer NOT NULL,
    "offspringId" integer,
    weight double precision,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: CampaignAttribution_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."CampaignAttribution_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: CampaignAttribution_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."CampaignAttribution_id_seq" OWNED BY public."CampaignAttribution".id;


--
-- Name: Campaign_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Campaign_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Campaign_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Campaign_id_seq" OWNED BY public."Campaign".id;


--
-- Name: CompetitionEntry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CompetitionEntry" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "animalId" integer NOT NULL,
    "eventName" text NOT NULL,
    "eventDate" timestamp(3) without time zone NOT NULL,
    location text,
    organization text,
    "competitionType" public."CompetitionType" NOT NULL,
    "className" text,
    placement integer,
    "placementLabel" text,
    "pointsEarned" double precision,
    "isMajorWin" boolean DEFAULT false NOT NULL,
    "qualifyingScore" boolean DEFAULT false NOT NULL,
    score double precision,
    "scoreMax" double precision,
    "judgeName" text,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "distanceFurlongs" double precision,
    "distanceMeters" integer,
    "finishTime" text,
    "handlerName" text,
    "prizeMoneyCents" integer,
    "raceGrade" text,
    "speedFigure" integer,
    "trackName" text,
    "trackSurface" text,
    "trainerName" text,
    "isPublic" boolean DEFAULT false NOT NULL
);


--
-- Name: CompetitionEntryDocument; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CompetitionEntryDocument" (
    id integer NOT NULL,
    "competitionEntryId" integer NOT NULL,
    "documentId" integer NOT NULL
);


--
-- Name: CompetitionEntryDocument_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."CompetitionEntryDocument_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: CompetitionEntryDocument_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."CompetitionEntryDocument_id_seq" OWNED BY public."CompetitionEntryDocument".id;


--
-- Name: CompetitionEntry_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."CompetitionEntry_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: CompetitionEntry_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."CompetitionEntry_id_seq" OWNED BY public."CompetitionEntry".id;


--
-- Name: Contact; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Contact" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "organizationId" integer,
    "partyId" integer,
    display_name text NOT NULL,
    first_name text,
    last_name text,
    nickname text,
    email public.citext,
    "phoneE164" character varying(32),
    "whatsappE164" character varying(32),
    street text,
    street2 text,
    city text,
    state text,
    zip text,
    country character(2),
    archived boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "externalProvider" text,
    "externalId" text,
    "deletedAt" timestamp(3) without time zone,
    "marketplaceFirstContactedAt" timestamp(3) without time zone,
    "marketplaceTotalSpentCents" bigint DEFAULT 0 NOT NULL,
    "marketplaceTotalTransactions" integer DEFAULT 0 NOT NULL,
    "marketplaceUserId" integer
);


--
-- Name: ContactChangeRequest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ContactChangeRequest" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "contactId" integer NOT NULL,
    "fieldName" text NOT NULL,
    "oldValue" text,
    "newValue" text NOT NULL,
    status public."ChangeRequestStatus" DEFAULT 'PENDING'::public."ChangeRequestStatus" NOT NULL,
    "requestedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "requestedBy" text,
    "resolvedAt" timestamp(3) without time zone,
    "resolvedBy" text,
    "resolutionNote" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: ContactChangeRequest_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."ContactChangeRequest_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ContactChangeRequest_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."ContactChangeRequest_id_seq" OWNED BY public."ContactChangeRequest".id;


--
-- Name: Contact_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Contact_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Contact_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Contact_id_seq" OWNED BY public."Contact".id;


--
-- Name: Contract; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Contract" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "templateId" integer,
    "offspringId" integer,
    "invoiceId" integer,
    title text NOT NULL,
    status public."ContractStatus" DEFAULT 'draft'::public."ContractStatus" NOT NULL,
    provider public."SignatureProvider" DEFAULT 'internal'::public."SignatureProvider" NOT NULL,
    "providerEnvelopeId" text,
    "providerDocId" text,
    "issuedAt" timestamp(3) without time zone,
    "signedAt" timestamp(3) without time zone,
    "voidedAt" timestamp(3) without time zone,
    "expiresAt" timestamp(3) without time zone,
    data jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "animalId" integer,
    "waitlistEntryId" integer,
    "breedingPlanId" integer
);


--
-- Name: ContractContent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ContractContent" (
    id integer NOT NULL,
    "contractId" integer NOT NULL,
    "renderedHtml" text NOT NULL,
    "renderedPdfKey" text,
    "mergeData" jsonb NOT NULL,
    "templateVersion" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ContractContent_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."ContractContent_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ContractContent_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."ContractContent_id_seq" OWNED BY public."ContractContent".id;


--
-- Name: ContractParty; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ContractParty" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "contractId" integer NOT NULL,
    "userId" text,
    "partyId" integer,
    role text,
    email text,
    name text,
    signer boolean DEFAULT true NOT NULL,
    "order" integer,
    status public."SignatureStatus" DEFAULT 'pending'::public."SignatureStatus" NOT NULL,
    "signedAt" timestamp(3) without time zone,
    "providerRecipientId" text,
    data jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "signatureData" jsonb
);


--
-- Name: ContractParty_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."ContractParty_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ContractParty_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."ContractParty_id_seq" OWNED BY public."ContractParty".id;


--
-- Name: ContractTemplate; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ContractTemplate" (
    id integer NOT NULL,
    "tenantId" integer,
    name text NOT NULL,
    body text,
    "storageKey" text,
    description text,
    "isActive" boolean DEFAULT true NOT NULL,
    data jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "bodyHtml" text,
    "bodyJson" jsonb,
    category public."ContractTemplateCategory" DEFAULT 'CUSTOM'::public."ContractTemplateCategory" NOT NULL,
    "conditionalSections" jsonb,
    "createdByUserId" text,
    "mergeFields" jsonb,
    slug text,
    type public."ContractTemplateType" DEFAULT 'CUSTOM'::public."ContractTemplateType" NOT NULL,
    version integer DEFAULT 1 NOT NULL
);


--
-- Name: ContractTemplate_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."ContractTemplate_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ContractTemplate_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."ContractTemplate_id_seq" OWNED BY public."ContractTemplate".id;


--
-- Name: Contract_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Contract_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Contract_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Contract_id_seq" OWNED BY public."Contract".id;


--
-- Name: CrossTenantAnimalLink; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CrossTenantAnimalLink" (
    id integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "childAnimalId" integer NOT NULL,
    "childTenantId" integer NOT NULL,
    "parentAnimalId" integer NOT NULL,
    "parentTenantId" integer NOT NULL,
    "parentType" public."ParentType" NOT NULL,
    "linkRequestId" integer,
    "linkMethod" public."LinkMethod" NOT NULL,
    active boolean DEFAULT true NOT NULL,
    "revokedAt" timestamp(3) without time zone,
    "revokedBy" public."RevokedBy",
    "revocationReason" text
);


--
-- Name: CrossTenantAnimalLink_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."CrossTenantAnimalLink_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: CrossTenantAnimalLink_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."CrossTenantAnimalLink_id_seq" OWNED BY public."CrossTenantAnimalLink".id;


--
-- Name: CustomBreed; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CustomBreed" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "createdByOrganizationId" integer,
    species public."Species" NOT NULL,
    name text NOT NULL,
    composition jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: CustomBreed_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."CustomBreed_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: CustomBreed_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."CustomBreed_id_seq" OWNED BY public."CustomBreed".id;


--
-- Name: DHIATestRecord; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DHIATestRecord" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "animalId" integer NOT NULL,
    "lactationCycleId" integer,
    "testDate" date NOT NULL,
    "testType" public."DHIATestType" DEFAULT 'STANDARD'::public."DHIATestType" NOT NULL,
    "daysInMilk" integer,
    "testDayMilkLbs" numeric(6,2) NOT NULL,
    "butterfatPct" numeric(4,2),
    "proteinPct" numeric(4,2),
    lactose numeric(4,2),
    "fatLbs" numeric(6,3),
    "proteinLbs" numeric(6,3),
    "somaticCellCount" integer,
    "milkUreaNitrogen" numeric(5,2),
    "labName" text,
    "labTestNumber" text,
    "certificateUrl" text,
    "documentId" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: DHIATestRecord_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."DHIATestRecord_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: DHIATestRecord_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."DHIATestRecord_id_seq" OWNED BY public."DHIATestRecord".id;


--
-- Name: DairyProductionHistory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DairyProductionHistory" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "animalId" integer NOT NULL,
    "totalLactations" integer DEFAULT 0 NOT NULL,
    "completedLactations" integer DEFAULT 0 NOT NULL,
    "best305DayMilkLbs" numeric(10,2),
    "best305DayFatLbs" numeric(8,3),
    "best305DayProteinLbs" numeric(8,3),
    "avg305DayMilkLbs" numeric(10,2),
    "avgPeakMilkLbs" numeric(6,2),
    "avgDaysToReachPeak" integer,
    "lifetimeMilkLbs" numeric(12,2),
    "lifetimeFatLbs" numeric(10,3),
    "lifetimeProteinLbs" numeric(10,3),
    "lifetimeAvgButterfatPct" numeric(4,2),
    "lifetimeAvgProteinPct" numeric(4,2),
    "lifetimeAvgSCC" integer,
    "bestAppraisalScore" integer,
    "bestAppraisalDate" date,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: DairyProductionHistory_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."DairyProductionHistory_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: DairyProductionHistory_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."DairyProductionHistory_id_seq" OWNED BY public."DairyProductionHistory".id;


--
-- Name: Deal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Deal" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "buyerId" integer NOT NULL,
    "animalId" integer,
    name character varying(255) NOT NULL,
    stage public."DealStage" DEFAULT 'INQUIRY'::public."DealStage" NOT NULL,
    "askingPrice" numeric(12,2),
    "offerPrice" numeric(12,2),
    "finalPrice" numeric(12,2),
    currency character(3) DEFAULT 'USD'::bpchar NOT NULL,
    "expectedCloseDate" timestamp(3) without time zone,
    "closedAt" timestamp(3) without time zone,
    outcome public."DealOutcome",
    "lostReason" character varying(500),
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: DealActivity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DealActivity" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "dealId" integer NOT NULL,
    type public."DealActivityType" NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    "scheduledAt" timestamp(3) without time zone,
    "completedAt" timestamp(3) without time zone,
    "userId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: DealActivity_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."DealActivity_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: DealActivity_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."DealActivity_id_seq" OWNED BY public."DealActivity".id;


--
-- Name: Deal_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Deal_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Deal_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Deal_id_seq" OWNED BY public."Deal".id;


--
-- Name: Document; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Document" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    scope public."DocumentScope" NOT NULL,
    kind public."DocumentKind" DEFAULT 'generic'::public."DocumentKind" NOT NULL,
    "animalId" integer,
    "ownershipChangeId" integer,
    "offspringId" integer,
    "invoiceId" integer,
    "contractId" integer,
    title text NOT NULL,
    "storageKey" text,
    "externalUrl" text,
    "mimeType" text,
    bytes integer,
    sha256 text,
    data jsonb,
    visibility public."DocVisibility" DEFAULT 'PRIVATE'::public."DocVisibility",
    status public."DocStatus" DEFAULT 'PLACEHOLDER'::public."DocStatus",
    "sizeBytes" integer,
    "originalFileName" text,
    "storageProvider" text,
    bucket text,
    "objectKey" text,
    url text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "watermarkEnabled" boolean DEFAULT false NOT NULL,
    "partyId" integer,
    "breedingPlanId" integer
);


--
-- Name: DocumentBundle; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DocumentBundle" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    name text NOT NULL,
    description text,
    status public."BundleStatus" DEFAULT 'active'::public."BundleStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: DocumentBundleItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DocumentBundleItem" (
    id integer NOT NULL,
    "bundleId" integer NOT NULL,
    "documentId" integer NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "addedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: DocumentBundleItem_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."DocumentBundleItem_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: DocumentBundleItem_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."DocumentBundleItem_id_seq" OWNED BY public."DocumentBundleItem".id;


--
-- Name: DocumentBundle_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."DocumentBundle_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: DocumentBundle_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."DocumentBundle_id_seq" OWNED BY public."DocumentBundle".id;


--
-- Name: Document_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Document_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Document_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Document_id_seq" OWNED BY public."Document".id;


--
-- Name: Draft; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Draft" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "partyId" integer,
    channel public."DraftChannel" NOT NULL,
    subject text,
    "toAddresses" text[],
    "bodyText" text NOT NULL,
    "bodyHtml" text,
    "templateId" integer,
    metadata jsonb,
    "createdByUserId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Draft_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Draft_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Draft_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Draft_id_seq" OWNED BY public."Draft".id;


--
-- Name: EmailChangeRequest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."EmailChangeRequest" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "contactId" integer NOT NULL,
    "oldEmail" text,
    "newEmail" text NOT NULL,
    "verificationToken" text NOT NULL,
    "verifiedAt" timestamp(3) without time zone,
    status public."EmailChangeStatus" DEFAULT 'PENDING_VERIFICATION'::public."EmailChangeStatus" NOT NULL,
    "requestedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: EmailChangeRequest_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."EmailChangeRequest_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: EmailChangeRequest_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."EmailChangeRequest_id_seq" OWNED BY public."EmailChangeRequest".id;


--
-- Name: EmailFilter; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."EmailFilter" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    pattern character varying(255) NOT NULL,
    type character varying(20) NOT NULL,
    reason text,
    "autoAdded" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdBy" text,
    "lastMatched" timestamp(3) without time zone
);


--
-- Name: EmailFilter_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."EmailFilter_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: EmailFilter_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."EmailFilter_id_seq" OWNED BY public."EmailFilter".id;


--
-- Name: EmailSendLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."EmailSendLog" (
    id integer NOT NULL,
    "tenantId" integer,
    "to" text NOT NULL,
    "from" text NOT NULL,
    subject text NOT NULL,
    "templateKey" text,
    "templateId" integer,
    category public."EmailSendCategory",
    provider text DEFAULT 'resend'::text NOT NULL,
    "providerMessageId" text,
    "relatedInvoiceId" integer,
    status public."EmailSendStatus" DEFAULT 'queued'::public."EmailSendStatus" NOT NULL,
    error jsonb,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    archived boolean DEFAULT false NOT NULL,
    "archivedAt" timestamp(3) without time zone,
    flagged boolean DEFAULT false NOT NULL,
    "flaggedAt" timestamp(3) without time zone,
    "partyId" integer,
    "retryCount" integer DEFAULT 0 NOT NULL,
    "nextRetryAt" timestamp with time zone,
    "lastEventAt" timestamp with time zone,
    "deliveryEvents" jsonb
);


--
-- Name: EmailSendLog_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."EmailSendLog_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: EmailSendLog_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."EmailSendLog_id_seq" OWNED BY public."EmailSendLog".id;


--
-- Name: Expense; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Expense" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "amountCents" integer NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    "incurredAt" timestamp(3) without time zone NOT NULL,
    category public."ExpenseCategory" NOT NULL,
    description text,
    "vendorPartyId" integer,
    "breedingPlanId" integer,
    "animalId" integer,
    notes text,
    data jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "foodProductId" integer,
    "quantityUnit" text,
    "quantityValue" double precision
);


--
-- Name: Expense_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Expense_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Expense_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Expense_id_seq" OWNED BY public."Expense".id;


--
-- Name: Feature; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Feature" (
    id integer NOT NULL,
    key character varying(100) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    module public."FeatureModule" NOT NULL,
    "entitlementKey" public."EntitlementKey" NOT NULL,
    "uiHint" character varying(200),
    "isActive" boolean DEFAULT true NOT NULL,
    "archivedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: FeatureCheck; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."FeatureCheck" (
    id bigint NOT NULL,
    "featureKey" character varying(100) NOT NULL,
    "tenantId" integer NOT NULL,
    "userId" text,
    granted boolean NOT NULL,
    context character varying(100),
    "timestamp" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: FeatureCheckDaily; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."FeatureCheckDaily" (
    id integer NOT NULL,
    date date NOT NULL,
    "featureKey" character varying(100) NOT NULL,
    "tenantId" integer NOT NULL,
    "checkCount" integer DEFAULT 0 NOT NULL,
    "grantCount" integer DEFAULT 0 NOT NULL,
    "denyCount" integer DEFAULT 0 NOT NULL
);


--
-- Name: FeatureCheckDaily_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."FeatureCheckDaily_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: FeatureCheckDaily_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."FeatureCheckDaily_id_seq" OWNED BY public."FeatureCheckDaily".id;


--
-- Name: FeatureCheck_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."FeatureCheck_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: FeatureCheck_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."FeatureCheck_id_seq" OWNED BY public."FeatureCheck".id;


--
-- Name: Feature_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Feature_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Feature_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Feature_id_seq" OWNED BY public."Feature".id;


--
-- Name: FeedingPlan; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."FeedingPlan" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "animalId" integer,
    "foodProductId" integer NOT NULL,
    "portionOz" double precision NOT NULL,
    "feedingsPerDay" integer DEFAULT 2 NOT NULL,
    "feedingTimes" text[],
    "startDate" timestamp(3) without time zone NOT NULL,
    "endDate" timestamp(3) without time zone,
    "autoCreateExpense" boolean DEFAULT false NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "breedingPlanId" integer
);


--
-- Name: FeedingPlan_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."FeedingPlan_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: FeedingPlan_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."FeedingPlan_id_seq" OWNED BY public."FeedingPlan".id;


--
-- Name: FeedingRecord; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."FeedingRecord" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "animalId" integer,
    "feedingPlanId" integer,
    "foodProductId" integer,
    "fedAt" timestamp(3) without time zone NOT NULL,
    "portionOz" double precision,
    "costCents" integer,
    skipped boolean DEFAULT false NOT NULL,
    "skipReason" text,
    "appetiteScore" integer,
    "expenseId" integer,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "breedingPlanId" integer
);


--
-- Name: FeedingRecord_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."FeedingRecord_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: FeedingRecord_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."FeedingRecord_id_seq" OWNED BY public."FeedingRecord".id;


--
-- Name: FiberLabTest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."FiberLabTest" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "animalId" integer NOT NULL,
    "shearingRecordId" integer,
    "testDate" date NOT NULL,
    "testType" public."FiberLabTestType" DEFAULT 'MICRON_ANALYSIS'::public."FiberLabTestType" NOT NULL,
    "labName" text,
    "avgFiberDiameter" numeric(5,2),
    "standardDeviation" numeric(5,2),
    "coefficientOfVariation" numeric(5,2),
    "comfortFactor" numeric(5,2),
    "spinningFineness" numeric(5,2),
    curvature numeric(6,2),
    "stapleStrengthNKtex" numeric(6,2),
    "positionOfBreak" text,
    "cleanFleeceYieldPct" numeric(5,2),
    "histogramData" jsonb,
    "certificateNumber" text,
    "certificateUrl" text,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: FiberLabTest_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."FiberLabTest_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: FiberLabTest_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."FiberLabTest_id_seq" OWNED BY public."FiberLabTest".id;


--
-- Name: FiberProductionHistory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."FiberProductionHistory" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "animalId" integer NOT NULL,
    "totalShearings" integer DEFAULT 0 NOT NULL,
    "totalGrossWeightLbs" numeric(10,2),
    "totalCleanWeightLbs" numeric(10,2),
    "avgGrossWeightLbs" numeric(6,2),
    "avgCleanWeightLbs" numeric(6,2),
    "avgYieldPct" numeric(5,2),
    "avgStapleLengthIn" numeric(4,2),
    "avgMicron" numeric(5,2),
    "micronTrend" text,
    "bestMicron" numeric(5,2),
    "bestFleeceWeightLbs" numeric(6,2),
    "bestGradeAchieved" public."FleeceGrade",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: FiberProductionHistory_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."FiberProductionHistory_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: FiberProductionHistory_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."FiberProductionHistory_id_seq" OWNED BY public."FiberProductionHistory".id;


--
-- Name: FoalingCheck; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."FoalingCheck" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "breedingPlanId" integer NOT NULL,
    "checkedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "checkedByUserId" text,
    "udderDevelopment" text DEFAULT 'none'::text NOT NULL,
    "vulvaRelaxation" text DEFAULT 'none'::text NOT NULL,
    "tailHeadRelaxation" text DEFAULT 'none'::text NOT NULL,
    temperature numeric(5,2),
    "behaviorNotes" text[] DEFAULT '{}'::text[] NOT NULL,
    "additionalNotes" text,
    "foalingImminent" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: FoalingCheck_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."FoalingCheck_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: FoalingCheck_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."FoalingCheck_id_seq" OWNED BY public."FoalingCheck".id;


--
-- Name: FoalingOutcome; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."FoalingOutcome" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "breedingPlanId" integer NOT NULL,
    "hadComplications" boolean DEFAULT false NOT NULL,
    "complicationDetails" text,
    "veterinarianCalled" boolean DEFAULT false NOT NULL,
    "veterinarianName" text,
    "veterinarianNotes" text,
    "placentaPassed" boolean,
    "placentaPassedMinutes" integer,
    "mareCondition" public."MarePostFoalingCondition",
    "postFoalingHeatDate" timestamp(3) without time zone,
    "postFoalingHeatNotes" text,
    "readyForRebreeding" boolean DEFAULT false NOT NULL,
    "rebredDate" timestamp(3) without time zone,
    "foalPhotoUrls" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "wasCSection" boolean DEFAULT false NOT NULL,
    "cSectionReason" text,
    "placentaCount" integer,
    "damRecoveryNotes" text,
    "totalBorn" integer,
    "bornAlive" integer,
    stillborn integer
);


--
-- Name: FoalingOutcome_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."FoalingOutcome_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: FoalingOutcome_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."FoalingOutcome_id_seq" OWNED BY public."FoalingOutcome".id;


--
-- Name: FoodChange; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."FoodChange" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "animalId" integer,
    "previousPlanId" integer,
    "newPlanId" integer NOT NULL,
    "changeDate" timestamp(3) without time zone NOT NULL,
    "changeReason" public."FoodChangeReason" NOT NULL,
    "reasonDetails" text,
    "transitionDays" integer,
    "transitionNotes" text,
    reactions text,
    "digestiveNotes" text,
    "overallSuccess" public."SuccessRating",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "breedingPlanId" integer
);


--
-- Name: FoodChange_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."FoodChange_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: FoodChange_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."FoodChange_id_seq" OWNED BY public."FoodChange".id;


--
-- Name: FoodProduct; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."FoodProduct" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    name text NOT NULL,
    brand text,
    sku text,
    "foodType" public."FoodType" NOT NULL,
    species public."Species"[],
    "lifeStage" public."LifeStage",
    "photoUrl" text,
    "bagSizeOz" integer,
    "costCents" integer,
    "costPerOzCents" integer,
    "servingSizeOz" double precision,
    "proteinPct" double precision,
    "fatPct" double precision,
    "fiberPct" double precision,
    "caloriesPerCup" integer,
    "isActive" boolean DEFAULT true NOT NULL,
    "isArchived" boolean DEFAULT false NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: FoodProduct_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."FoodProduct_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: FoodProduct_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."FoodProduct_id_seq" OWNED BY public."FoodProduct".id;


--
-- Name: GeneticNotificationPreference; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."GeneticNotificationPreference" (
    id integer NOT NULL,
    "userId" text NOT NULL,
    "tenantId" integer NOT NULL,
    "inAppMissing" boolean DEFAULT true NOT NULL,
    "inAppIncomplete" boolean DEFAULT true NOT NULL,
    "inAppCarrier" boolean DEFAULT true NOT NULL,
    "inAppPrebreeding" boolean DEFAULT true NOT NULL,
    "inAppRegistry" boolean DEFAULT true NOT NULL,
    "inAppRecommended" boolean DEFAULT false NOT NULL,
    "emailMissing" boolean DEFAULT false NOT NULL,
    "emailIncomplete" boolean DEFAULT false NOT NULL,
    "emailCarrier" boolean DEFAULT true NOT NULL,
    "emailPrebreeding" boolean DEFAULT true NOT NULL,
    "emailRegistry" boolean DEFAULT true NOT NULL,
    "emailRecommended" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: GeneticNotificationPreference_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."GeneticNotificationPreference_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: GeneticNotificationPreference_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."GeneticNotificationPreference_id_seq" OWNED BY public."GeneticNotificationPreference".id;


--
-- Name: GeneticNotificationSnooze; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."GeneticNotificationSnooze" (
    id integer NOT NULL,
    "userId" text NOT NULL,
    "tenantId" integer NOT NULL,
    "snoozeType" public."GeneticSnoozeType" NOT NULL,
    "animalId" integer,
    "testCode" text,
    "snoozedUntil" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: GeneticNotificationSnooze_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."GeneticNotificationSnooze_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: GeneticNotificationSnooze_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."GeneticNotificationSnooze_id_seq" OWNED BY public."GeneticNotificationSnooze".id;


--
-- Name: GeneticsDisclaimerAcceptance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."GeneticsDisclaimerAcceptance" (
    id integer NOT NULL,
    "userId" text NOT NULL,
    "acceptedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "ipAddress" character varying(45),
    "userAgent" text
);


--
-- Name: GeneticsDisclaimerAcceptance_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."GeneticsDisclaimerAcceptance_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: GeneticsDisclaimerAcceptance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."GeneticsDisclaimerAcceptance_id_seq" OWNED BY public."GeneticsDisclaimerAcceptance".id;


--
-- Name: GlobalAnimalIdentifier; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."GlobalAnimalIdentifier" (
    id integer NOT NULL,
    "identityId" integer NOT NULL,
    type public."IdentifierType" NOT NULL,
    value text NOT NULL,
    "rawValue" text,
    confidence double precision DEFAULT 1.0 NOT NULL,
    "verifiedAt" timestamp(3) without time zone,
    "verifiedBy" text,
    "sourceTenantId" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: GlobalAnimalIdentifier_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."GlobalAnimalIdentifier_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: GlobalAnimalIdentifier_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."GlobalAnimalIdentifier_id_seq" OWNED BY public."GlobalAnimalIdentifier".id;


--
-- Name: GlobalAnimalIdentity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."GlobalAnimalIdentity" (
    id integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    species public."Species" NOT NULL,
    sex public."Sex",
    "birthDate" timestamp(3) without time zone,
    name text,
    "damId" integer,
    "sireId" integer,
    gaid text
);


--
-- Name: GlobalAnimalIdentity_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."GlobalAnimalIdentity_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: GlobalAnimalIdentity_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."GlobalAnimalIdentity_id_seq" OWNED BY public."GlobalAnimalIdentity".id;


--
-- Name: HealthEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."HealthEvent" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "offspringId" integer NOT NULL,
    kind public."HealthType" NOT NULL,
    "occurredAt" timestamp(3) without time zone NOT NULL,
    "weightGrams" integer,
    "vaccineCode" text,
    dose text,
    "vetClinic" text,
    result text,
    notes text,
    data jsonb,
    "recordedByUserId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: HealthEvent_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."HealthEvent_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: HealthEvent_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."HealthEvent_id_seq" OWNED BY public."HealthEvent".id;


--
-- Name: HelpArticleEmbedding; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."HelpArticleEmbedding" (
    id integer NOT NULL,
    slug text NOT NULL,
    "chunkIndex" integer DEFAULT 0 NOT NULL,
    title text NOT NULL,
    module text NOT NULL,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    summary text,
    "chunkText" text NOT NULL,
    embedding public.vector(512) NOT NULL,
    "contentHash" text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    "indexedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: HelpArticleEmbedding_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."HelpArticleEmbedding_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: HelpArticleEmbedding_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."HelpArticleEmbedding_id_seq" OWNED BY public."HelpArticleEmbedding".id;


--
-- Name: HelpQueryLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."HelpQueryLog" (
    id integer NOT NULL,
    "userId" text NOT NULL,
    "tenantId" integer NOT NULL,
    query text NOT NULL,
    response text,
    "sourceSlugs" text[] DEFAULT '{}'::text[] NOT NULL,
    "feedbackRating" smallint,
    "feedbackText" text,
    "modelUsed" text DEFAULT 'claude-haiku-4-5-20251001'::text NOT NULL,
    "tokenCount" integer,
    "latencyMs" integer,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: HelpQueryLog_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."HelpQueryLog_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: HelpQueryLog_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."HelpQueryLog_id_seq" OWNED BY public."HelpQueryLog".id;


--
-- Name: IdempotencyKey; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."IdempotencyKey" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    key text NOT NULL,
    "requestHash" text NOT NULL,
    "responseBody" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: IdempotencyKey_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."IdempotencyKey_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: IdempotencyKey_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."IdempotencyKey_id_seq" OWNED BY public."IdempotencyKey".id;


--
-- Name: Invite; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Invite" (
    id integer NOT NULL,
    email text NOT NULL,
    "organizationId" integer,
    role text DEFAULT 'STAFF'::text NOT NULL,
    token text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "consumedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Invite_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Invite_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Invite_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Invite_id_seq" OWNED BY public."Invite".id;


--
-- Name: Invoice; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Invoice" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    scope public."FinanceScope" NOT NULL,
    "offspringId" integer,
    "clientPartyId" integer,
    "animalId" integer,
    "breedingPlanId" integer,
    "invoiceNumber" text NOT NULL,
    number text,
    currency text DEFAULT 'USD'::text NOT NULL,
    "amountCents" bigint NOT NULL,
    "balanceCents" bigint NOT NULL,
    "depositCents" bigint,
    status public."InvoiceStatus" DEFAULT 'draft'::public."InvoiceStatus" NOT NULL,
    category public."InvoiceCategory" DEFAULT 'OTHER'::public."InvoiceCategory" NOT NULL,
    "dueAt" timestamp(3) without time zone,
    "issuedAt" timestamp(3) without time zone,
    "paidAt" timestamp(3) without time zone,
    "voidedAt" timestamp(3) without time zone,
    "paymentTerms" text,
    "externalProvider" text,
    "externalId" text,
    "syncedAt" timestamp(3) without time zone,
    "lastSyncStatus" text,
    "lastSyncError" text,
    notes text,
    data jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "waitlistEntryId" integer,
    "buyerMarkedPaidAt" timestamp(3) without time zone,
    "buyerPaymentMethod" text,
    "buyerPaymentReference" text,
    "deletedAt" timestamp(3) without time zone,
    "isMarketplaceInvoice" boolean DEFAULT false NOT NULL,
    "marketplaceTransactionId" integer,
    "paymentModeSnapshot" text,
    "providerConfirmedAt" timestamp(3) without time zone,
    "providerConfirmedBy" integer,
    "refundedCents" bigint DEFAULT 0 NOT NULL,
    "stripeInvoiceId" text,
    "stripePaymentIntentId" text,
    "breedingPlanBuyerId" integer,
    "offspringGroupBuyerId" integer
);


--
-- Name: InvoiceLineItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."InvoiceLineItem" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "invoiceId" integer NOT NULL,
    kind public."LineItemKind" DEFAULT 'OTHER'::public."LineItemKind" NOT NULL,
    description text NOT NULL,
    qty integer DEFAULT 1 NOT NULL,
    "unitCents" integer NOT NULL,
    "discountCents" integer,
    "taxRate" double precision,
    category text,
    "itemCode" text,
    "totalCents" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: InvoiceLineItem_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."InvoiceLineItem_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: InvoiceLineItem_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."InvoiceLineItem_id_seq" OWNED BY public."InvoiceLineItem".id;


--
-- Name: Invoice_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Invoice_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Invoice_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Invoice_id_seq" OWNED BY public."Invoice".id;


--
-- Name: LactationCycle; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."LactationCycle" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "animalId" integer NOT NULL,
    "lactationNumber" integer NOT NULL,
    status public."LactationStatus" DEFAULT 'FRESH'::public."LactationStatus" NOT NULL,
    "freshenDate" date NOT NULL,
    "dryOffDate" date,
    "milkingFrequency" public."MilkingFrequency" DEFAULT 'TWICE_DAILY'::public."MilkingFrequency" NOT NULL,
    "days305MilkLbs" numeric(10,2),
    "days305FatLbs" numeric(8,3),
    "days305ProteinLbs" numeric(8,3),
    "peakMilkDate" date,
    "peakMilkLbs" numeric(6,2),
    "daysToReachPeak" integer,
    "avgButterfatPct" numeric(4,2),
    "avgProteinPct" numeric(4,2),
    "avgSCC" integer,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: LactationCycle_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."LactationCycle_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: LactationCycle_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."LactationCycle_id_seq" OWNED BY public."LactationCycle".id;


--
-- Name: LinearAppraisal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."LinearAppraisal" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "animalId" integer NOT NULL,
    "appraisalDate" date NOT NULL,
    "appraiserName" text,
    "appraiserId" text,
    "finalScore" integer NOT NULL,
    classification text,
    "generalAppearance" integer,
    "dairyCharacter" integer,
    "bodyCapacity" integer,
    "mammarySystem" integer,
    "allScores" jsonb,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: LinearAppraisal_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."LinearAppraisal_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: LinearAppraisal_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."LinearAppraisal_id_seq" OWNED BY public."LinearAppraisal".id;


--
-- Name: ListingBoost; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ListingBoost" (
    id integer NOT NULL,
    "tenantId" integer,
    "providerId" integer,
    "listingType" public."ListingBoostTarget" NOT NULL,
    "listingId" integer NOT NULL,
    tier public."BoostTier" NOT NULL,
    weight double precision NOT NULL,
    "durationDays" integer NOT NULL,
    status public."BoostStatus" DEFAULT 'PENDING'::public."BoostStatus" NOT NULL,
    "startsAt" timestamp(3) without time zone,
    "expiresAt" timestamp(3) without time zone,
    "autoRenew" boolean DEFAULT false NOT NULL,
    "amountCents" integer NOT NULL,
    currency character varying(3) DEFAULT 'USD'::character varying NOT NULL,
    "stripeSessionId" text,
    "stripePaymentId" text,
    impressions integer DEFAULT 0 NOT NULL,
    clicks integer DEFAULT 0 NOT NULL,
    inquiries integer DEFAULT 0 NOT NULL,
    "expiryNotifiedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "expiredNotifiedAt" timestamp(3) without time zone
);


--
-- Name: ListingBoost_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."ListingBoost_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ListingBoost_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."ListingBoost_id_seq" OWNED BY public."ListingBoost".id;


--
-- Name: Litter; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Litter" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "planId" integer NOT NULL,
    identifier text,
    "birthedStartAt" timestamp(3) without time zone,
    "birthedEndAt" timestamp(3) without time zone,
    "countBorn" integer,
    "countLive" integer,
    "countStillborn" integer,
    "countMale" integer,
    "countFemale" integer,
    "countWeaned" integer,
    "countPlaced" integer,
    "weanedAt" timestamp(3) without time zone,
    "placementStartAt" timestamp(3) without time zone,
    "placementCompletedAt" timestamp(3) without time zone,
    "statusOverride" text,
    "statusOverrideReason" text,
    "coverImageUrl" text,
    "themeName" text,
    notes text,
    data jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "marketplaceStatus" public."MarketplaceListingStatus" DEFAULT 'DRAFT'::public."MarketplaceListingStatus" NOT NULL
);


--
-- Name: LitterEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."LitterEvent" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "litterId" integer NOT NULL,
    type text NOT NULL,
    "occurredAt" timestamp(3) without time zone NOT NULL,
    field text,
    before jsonb,
    after jsonb,
    notes text,
    "recordedByUserId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "breedingPlanId" integer
);


--
-- Name: LitterEvent_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."LitterEvent_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: LitterEvent_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."LitterEvent_id_seq" OWNED BY public."LitterEvent".id;


--
-- Name: Litter_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Litter_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Litter_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Litter_id_seq" OWNED BY public."Litter".id;


--
-- Name: MareReproductiveHistory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MareReproductiveHistory" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "mareId" integer NOT NULL,
    "totalFoalings" integer DEFAULT 0 NOT NULL,
    "totalLiveFoals" integer DEFAULT 0 NOT NULL,
    "totalComplicatedFoalings" integer DEFAULT 0 NOT NULL,
    "totalVeterinaryInterventions" integer DEFAULT 0 NOT NULL,
    "totalRetainedPlacentas" integer DEFAULT 0 NOT NULL,
    "lastFoalingDate" timestamp(3) without time zone,
    "lastFoalingComplications" boolean,
    "lastMareCondition" text,
    "lastPlacentaPassed" boolean,
    "lastPlacentaMinutes" integer,
    "avgPostFoalingHeatDays" double precision,
    "minPostFoalingHeatDays" integer,
    "maxPostFoalingHeatDays" integer,
    "lastPostFoalingHeatDate" timestamp(3) without time zone,
    "lastReadyForRebreeding" boolean,
    "lastRebredDate" timestamp(3) without time zone,
    "riskScore" integer DEFAULT 0 NOT NULL,
    "riskFactors" text[],
    notes text,
    "lastUpdatedFromPlanId" integer,
    "lastUpdatedFromBreedYear" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "isBarren" boolean DEFAULT false NOT NULL
);


--
-- Name: MareReproductiveHistory_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."MareReproductiveHistory_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: MareReproductiveHistory_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."MareReproductiveHistory_id_seq" OWNED BY public."MareReproductiveHistory".id;


--
-- Name: MarketplaceUserBlock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MarketplaceUserBlock" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "blockedUserId" character varying(36) NOT NULL,
    level public."MarketplaceBlockLevel" NOT NULL,
    reason text,
    "blockedByPartyId" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "liftedAt" timestamp(3) without time zone,
    "liftedByPartyId" integer
);


--
-- Name: MarketplaceUserBlock_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."MarketplaceUserBlock_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: MarketplaceUserBlock_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."MarketplaceUserBlock_id_seq" OWNED BY public."MarketplaceUserBlock".id;


--
-- Name: MarketplaceUserFlag; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MarketplaceUserFlag" (
    id integer NOT NULL,
    "userId" character varying(36) NOT NULL,
    "totalBlocks" integer DEFAULT 0 NOT NULL,
    "activeBlocks" integer DEFAULT 0 NOT NULL,
    "lightBlocks" integer DEFAULT 0 NOT NULL,
    "mediumBlocks" integer DEFAULT 0 NOT NULL,
    "heavyBlocks" integer DEFAULT 0 NOT NULL,
    "totalApprovals" integer DEFAULT 0 NOT NULL,
    "totalRejections" integer DEFAULT 0 NOT NULL,
    "flaggedAt" timestamp(3) without time zone,
    "flagReason" text,
    "suspendedAt" timestamp(3) without time zone,
    "suspendedReason" text,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: MarketplaceUserFlag_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."MarketplaceUserFlag_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: MarketplaceUserFlag_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."MarketplaceUserFlag_id_seq" OWNED BY public."MarketplaceUserFlag".id;


--
-- Name: MediaAccessEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MediaAccessEvent" (
    id integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "tenantId" integer NOT NULL,
    "documentId" integer,
    "storageKey" text NOT NULL,
    "actorType" public."MediaAccessActor" NOT NULL,
    "userId" character varying(36),
    "marketplaceUserId" integer,
    "partyId" integer,
    "accessType" public."MediaAccessType" NOT NULL,
    ip character varying(45),
    "userAgent" text,
    watermarked boolean DEFAULT false NOT NULL,
    "watermarkHash" character varying(32)
);


--
-- Name: MediaAccessEvent_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."MediaAccessEvent_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: MediaAccessEvent_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."MediaAccessEvent_id_seq" OWNED BY public."MediaAccessEvent".id;


--
-- Name: Membership; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Membership" (
    "userId" text NOT NULL,
    "organizationId" integer NOT NULL,
    role public."MembershipRole" DEFAULT 'MEMBER'::public."MembershipRole" NOT NULL
);


--
-- Name: Message; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Message" (
    id integer NOT NULL,
    "threadId" integer NOT NULL,
    "senderPartyId" integer,
    body text NOT NULL,
    "isAutomated" boolean DEFAULT false NOT NULL,
    "automationRuleId" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "attachmentBytes" integer,
    "attachmentFilename" text,
    "attachmentKey" text,
    "attachmentMime" text
);


--
-- Name: MessageParticipant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MessageParticipant" (
    id integer NOT NULL,
    "threadId" integer NOT NULL,
    "partyId" integer NOT NULL,
    "lastReadAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: MessageParticipant_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."MessageParticipant_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: MessageParticipant_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."MessageParticipant_id_seq" OWNED BY public."MessageParticipant".id;


--
-- Name: MessageThread; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MessageThread" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    subject text,
    archived boolean DEFAULT false NOT NULL,
    "lastMessageAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "inquiryType" text,
    "sourceListingSlug" text,
    "guestEmail" text,
    "guestName" text,
    "businessHoursResponseTime" integer,
    "firstInboundAt" timestamp(3) without time zone,
    "firstOrgReplyAt" timestamp(3) without time zone,
    "responseTimeSeconds" integer,
    flagged boolean DEFAULT false NOT NULL,
    "flaggedAt" timestamp(3) without time zone,
    "originPagePath" text,
    "originReferrer" text,
    "originSource" text,
    "originUtmCampaign" text,
    "originUtmMedium" text,
    "originUtmSource" text,
    "authenticationPass" boolean,
    "isQuarantined" boolean DEFAULT false NOT NULL,
    "spamFlags" text[] DEFAULT ARRAY[]::text[],
    "spamScore" integer DEFAULT 0,
    "contextType" text
);


--
-- Name: MessageThread_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."MessageThread_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: MessageThread_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."MessageThread_id_seq" OWNED BY public."MessageThread".id;


--
-- Name: Message_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Message_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Message_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Message_id_seq" OWNED BY public."Message".id;


--
-- Name: MicrochipRegistry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MicrochipRegistry" (
    id integer NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    website text,
    "renewalType" public."MicrochipRenewalType" DEFAULT 'UNKNOWN'::public."MicrochipRenewalType" NOT NULL,
    species text[],
    "isActive" boolean DEFAULT true NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: MicrochipRegistry_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."MicrochipRegistry_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: MicrochipRegistry_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."MicrochipRegistry_id_seq" OWNED BY public."MicrochipRegistry".id;


--
-- Name: MilkingRecord; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MilkingRecord" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "animalId" integer NOT NULL,
    "lactationCycleId" integer,
    "milkedAt" timestamp(3) without time zone NOT NULL,
    "sessionNumber" integer,
    "daysInMilk" integer,
    "milkLbs" numeric(6,2) NOT NULL,
    "butterfatPct" numeric(4,2),
    "proteinPct" numeric(4,2),
    "somaticCellCount" integer,
    lactose numeric(4,2),
    conductivity numeric(6,2),
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: MilkingRecord_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."MilkingRecord_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: MilkingRecord_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."MilkingRecord_id_seq" OWNED BY public."MilkingRecord".id;


--
-- Name: NeonatalCareEntry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."NeonatalCareEntry" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "offspringId" integer NOT NULL,
    "recordedAt" timestamp(3) without time zone NOT NULL,
    "recordedBy" text,
    "recordedById" text,
    "weightOz" numeric(6,2),
    "weightChangePercent" numeric(5,2),
    "temperatureF" numeric(4,1),
    "feedingMethod" public."NeonatalFeedingMethod",
    "feedingVolumeMl" numeric(5,1),
    "feedingNotes" text,
    urinated boolean,
    "stoolQuality" public."StoolQuality",
    "activityLevel" public."ActivityLevel",
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: NeonatalCareEntry_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."NeonatalCareEntry_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: NeonatalCareEntry_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."NeonatalCareEntry_id_seq" OWNED BY public."NeonatalCareEntry".id;


--
-- Name: NeonatalIntervention; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."NeonatalIntervention" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "offspringId" integer NOT NULL,
    "occurredAt" timestamp(3) without time zone NOT NULL,
    type public."NeonatalInterventionType" NOT NULL,
    route public."InterventionRoute",
    dose text,
    "administeredBy" public."AdministeredBy",
    "vetClinic" text,
    reason text,
    response public."InterventionResponse",
    "followUpNeeded" boolean DEFAULT false NOT NULL,
    "followUpDate" timestamp(3) without time zone,
    cost numeric(10,2),
    notes text,
    "recordedById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: NeonatalIntervention_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."NeonatalIntervention_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: NeonatalIntervention_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."NeonatalIntervention_id_seq" OWNED BY public."NeonatalIntervention".id;


--
-- Name: NetworkBreedingInquiry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."NetworkBreedingInquiry" (
    id integer NOT NULL,
    "senderTenantId" integer NOT NULL,
    "recipientTenantId" integer NOT NULL,
    "searchCriteria" jsonb NOT NULL,
    "matchingAnimalIds" integer[],
    "matchedTraits" text[],
    message text,
    status public."NetworkInquiryStatus" DEFAULT 'PENDING'::public."NetworkInquiryStatus" NOT NULL,
    "respondedAt" timestamp(3) without time zone,
    "messageThreadId" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: NetworkBreedingInquiry_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."NetworkBreedingInquiry_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: NetworkBreedingInquiry_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."NetworkBreedingInquiry_id_seq" OWNED BY public."NetworkBreedingInquiry".id;


--
-- Name: NetworkSearchIndex; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."NetworkSearchIndex" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    species public."Species" NOT NULL,
    sex public."Sex" NOT NULL,
    "geneticTraits" jsonb NOT NULL,
    "physicalTraits" jsonb,
    "healthClearances" jsonb,
    "animalCount" integer DEFAULT 1 NOT NULL,
    "lastRebuiltAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: NetworkSearchIndex_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."NetworkSearchIndex_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: NetworkSearchIndex_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."NetworkSearchIndex_id_seq" OWNED BY public."NetworkSearchIndex".id;


--
-- Name: Notification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Notification" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "userId" text,
    type public."NotificationType" NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    "linkUrl" text,
    priority public."NotificationPriority" DEFAULT 'MEDIUM'::public."NotificationPriority" NOT NULL,
    status public."NotificationStatus" DEFAULT 'UNREAD'::public."NotificationStatus" NOT NULL,
    "readAt" timestamp(3) without time zone,
    "dismissedAt" timestamp(3) without time zone,
    "idempotencyKey" text,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Notification_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Notification_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Notification_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Notification_id_seq" OWNED BY public."Notification".id;


--
-- Name: Offspring; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Offspring" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    name text,
    species public."Species" NOT NULL,
    breed text,
    sex public."Sex",
    "bornAt" timestamp(3) without time zone,
    "diedAt" timestamp(3) without time zone,
    status public."OffspringStatus" DEFAULT 'NEWBORN'::public."OffspringStatus" NOT NULL,
    "lifeState" public."OffspringLifeState" DEFAULT 'ALIVE'::public."OffspringLifeState" NOT NULL,
    "placementState" public."OffspringPlacementState" DEFAULT 'UNASSIGNED'::public."OffspringPlacementState" NOT NULL,
    "keeperIntent" public."OffspringKeeperIntent" DEFAULT 'AVAILABLE'::public."OffspringKeeperIntent" NOT NULL,
    "financialState" public."OffspringFinancialState" DEFAULT 'NONE'::public."OffspringFinancialState" NOT NULL,
    "paperworkState" public."OffspringPaperworkState" DEFAULT 'NONE'::public."OffspringPaperworkState" NOT NULL,
    "damId" integer,
    "sireId" integer,
    "collarColorId" text,
    "collarColorName" text,
    "collarColorHex" text,
    "collarAssignedAt" timestamp(3) without time zone,
    "collarLocked" boolean DEFAULT false NOT NULL,
    "buyerPartyId" integer,
    "priceCents" integer,
    "depositCents" integer,
    "contractId" text,
    "contractSignedAt" timestamp(3) without time zone,
    "paidInFullAt" timestamp(3) without time zone,
    "pickupAt" timestamp(3) without time zone,
    "placedAt" timestamp(3) without time zone,
    "promotedAnimalId" integer,
    notes text,
    data jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "marketplaceListed" boolean DEFAULT false NOT NULL,
    "marketplacePriceCents" integer,
    "birthWeight" double precision,
    color text,
    "healthNotes" text,
    "healthStatus" public."FoalHealthStatus" DEFAULT 'HEALTHY'::public."FoalHealthStatus" NOT NULL,
    "nursingMinutes" integer,
    "nursingStatus" public."FoalNursingStatus" DEFAULT 'UNKNOWN'::public."FoalNursingStatus" NOT NULL,
    "requiredVetCare" boolean DEFAULT false NOT NULL,
    "standingMinutes" integer,
    "vetCareDetails" text,
    "archiveReason" text,
    "archivedAt" timestamp(3) without time zone,
    "birthWeightOz" double precision,
    "isExtraNeeds" boolean DEFAULT false NOT NULL,
    "neonatalFeedingMethod" public."NeonatalFeedingMethod",
    "neonatalHealthStatus" public."NeonatalHealthStatus",
    "breedingPlanId" integer NOT NULL
);


--
-- Name: OffspringContract; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."OffspringContract" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "offspringId" integer NOT NULL,
    title text NOT NULL,
    version text,
    provider public."EsignProvider",
    status public."EsignStatus" DEFAULT 'DRAFT'::public."EsignStatus" NOT NULL,
    "sentAt" timestamp(3) without time zone,
    "viewedAt" timestamp(3) without time zone,
    "signedAt" timestamp(3) without time zone,
    "fileId" integer,
    "buyerPartyId" integer,
    "metaJson" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: OffspringContract_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."OffspringContract_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: OffspringContract_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."OffspringContract_id_seq" OWNED BY public."OffspringContract".id;


--
-- Name: OffspringDocument; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."OffspringDocument" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "offspringId" integer NOT NULL,
    name text NOT NULL,
    "templateId" text,
    provider public."EsignProvider",
    status public."EsignStatus" DEFAULT 'DRAFT'::public."EsignStatus" NOT NULL,
    "sentAt" timestamp(3) without time zone,
    "viewedAt" timestamp(3) without time zone,
    "completedAt" timestamp(3) without time zone,
    "fileId" integer,
    "metaJson" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: OffspringDocument_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."OffspringDocument_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: OffspringDocument_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."OffspringDocument_id_seq" OWNED BY public."OffspringDocument".id;


--
-- Name: OffspringEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."OffspringEvent" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "offspringId" integer NOT NULL,
    type text NOT NULL,
    "occurredAt" timestamp(3) without time zone NOT NULL,
    field text,
    before jsonb,
    after jsonb,
    notes text,
    "recordedByUserId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: OffspringEvent_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."OffspringEvent_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: OffspringEvent_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."OffspringEvent_id_seq" OWNED BY public."OffspringEvent".id;


--
-- Name: OffspringInvoiceLink; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."OffspringInvoiceLink" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "offspringId" integer NOT NULL,
    "invoiceId" integer,
    role public."InvoiceRole" DEFAULT 'MISC'::public."InvoiceRole" NOT NULL,
    "amountCents" integer,
    currency text,
    "externalProvider" text,
    "externalId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: OffspringInvoiceLink_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."OffspringInvoiceLink_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: OffspringInvoiceLink_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."OffspringInvoiceLink_id_seq" OWNED BY public."OffspringInvoiceLink".id;


--
-- Name: OffspringProtocolException; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."OffspringProtocolException" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "assignmentId" integer NOT NULL,
    "offspringId" integer NOT NULL,
    "activityId" text NOT NULL,
    "checklistItemKey" text,
    "exceptionType" public."RearingExceptionType" NOT NULL,
    reason text NOT NULL,
    "startDate" timestamp(3) without time zone,
    "endDate" timestamp(3) without time zone,
    "createdBy" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: OffspringProtocolException_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."OffspringProtocolException_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: OffspringProtocolException_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."OffspringProtocolException_id_seq" OWNED BY public."OffspringProtocolException".id;


--
-- Name: Offspring_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Offspring_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Offspring_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Offspring_id_seq" OWNED BY public."Offspring".id;


--
-- Name: Organization; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Organization" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "partyId" integer NOT NULL,
    name text NOT NULL,
    email text,
    phone text,
    website text,
    street text,
    street2 text,
    city text,
    state text,
    zip text,
    country text,
    archived boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "externalProvider" text,
    "externalId" text,
    "programSlug" text,
    "isPublicProgram" boolean DEFAULT false NOT NULL,
    "programBio" text,
    "publicContactEmail" text
);


--
-- Name: Organization_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Organization_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Organization_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Organization_id_seq" OWNED BY public."Organization".id;


--
-- Name: Party; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Party" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    type public."PartyType" NOT NULL,
    name text NOT NULL,
    email public.citext,
    "phoneE164" character varying(32),
    "whatsappE164" character varying(32),
    street text,
    street2 text,
    city text,
    state text,
    "postalCode" text,
    country character(2),
    archived boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: PartyActivity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PartyActivity" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "partyId" integer NOT NULL,
    kind public."PartyActivityKind" NOT NULL,
    title text NOT NULL,
    detail text,
    metadata jsonb,
    "actorId" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: PartyActivity_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."PartyActivity_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: PartyActivity_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."PartyActivity_id_seq" OWNED BY public."PartyActivity".id;


--
-- Name: PartyCommPreference; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PartyCommPreference" (
    id integer NOT NULL,
    "partyId" integer NOT NULL,
    channel public."CommChannel" NOT NULL,
    preference public."PreferenceLevel" DEFAULT 'ALLOW'::public."PreferenceLevel" NOT NULL,
    compliance public."ComplianceStatus",
    "complianceSetAt" timestamp(3) without time zone,
    "complianceSource" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: PartyCommPreferenceEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PartyCommPreferenceEvent" (
    id integer NOT NULL,
    "partyId" integer NOT NULL,
    channel public."CommChannel" NOT NULL,
    "prevPreference" public."PreferenceLevel",
    "newPreference" public."PreferenceLevel",
    "prevCompliance" public."ComplianceStatus",
    "newCompliance" public."ComplianceStatus",
    "actorPartyId" integer,
    reason text,
    source text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: PartyCommPreferenceEvent_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."PartyCommPreferenceEvent_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: PartyCommPreferenceEvent_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."PartyCommPreferenceEvent_id_seq" OWNED BY public."PartyCommPreferenceEvent".id;


--
-- Name: PartyCommPreference_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."PartyCommPreference_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: PartyCommPreference_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."PartyCommPreference_id_seq" OWNED BY public."PartyCommPreference".id;


--
-- Name: PartyEmail; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PartyEmail" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "partyId" integer NOT NULL,
    subject text NOT NULL,
    body text NOT NULL,
    "toEmail" text NOT NULL,
    "sentAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    status text DEFAULT 'sent'::text NOT NULL,
    "messageId" text,
    "createdBy" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "isRead" boolean DEFAULT false NOT NULL
);


--
-- Name: PartyEmail_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."PartyEmail_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: PartyEmail_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."PartyEmail_id_seq" OWNED BY public."PartyEmail".id;


--
-- Name: PartyEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PartyEvent" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "partyId" integer NOT NULL,
    kind public."PartyEventKind" DEFAULT 'FOLLOW_UP'::public."PartyEventKind" NOT NULL,
    title text NOT NULL,
    notes text,
    "scheduledAt" timestamp(3) without time zone NOT NULL,
    status public."PartyEventStatus" DEFAULT 'SCHEDULED'::public."PartyEventStatus" NOT NULL,
    "completedAt" timestamp(3) without time zone,
    "createdBy" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: PartyEvent_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."PartyEvent_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: PartyEvent_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."PartyEvent_id_seq" OWNED BY public."PartyEvent".id;


--
-- Name: PartyMilestone; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PartyMilestone" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "partyId" integer NOT NULL,
    kind public."PartyMilestoneKind" DEFAULT 'CUSTOM'::public."PartyMilestoneKind" NOT NULL,
    label text NOT NULL,
    date date NOT NULL,
    annual boolean DEFAULT true NOT NULL,
    notes text,
    "createdBy" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: PartyMilestone_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."PartyMilestone_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: PartyMilestone_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."PartyMilestone_id_seq" OWNED BY public."PartyMilestone".id;


--
-- Name: PartyNote; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PartyNote" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "partyId" integer NOT NULL,
    content text NOT NULL,
    pinned boolean DEFAULT false NOT NULL,
    "createdBy" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: PartyNote_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."PartyNote_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: PartyNote_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."PartyNote_id_seq" OWNED BY public."PartyNote".id;


--
-- Name: Party_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Party_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Party_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Party_id_seq" OWNED BY public."Party".id;


--
-- Name: Payment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Payment" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "invoiceId" integer NOT NULL,
    status public."PaymentStatus" DEFAULT 'pending'::public."PaymentStatus" NOT NULL,
    "amountCents" bigint NOT NULL,
    "receivedAt" timestamp(3) without time zone NOT NULL,
    "methodType" text,
    processor text,
    "processorRef" text,
    method text,
    reference text,
    "paidAt" timestamp(3) without time zone,
    "externalProvider" text,
    "externalId" text,
    "syncedAt" timestamp(3) without time zone,
    "lastSyncStatus" text,
    "lastSyncError" text,
    notes text,
    data jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: PaymentIntent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PaymentIntent" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "invoiceId" integer,
    "animalId" integer,
    "ownershipChangeId" integer,
    purpose public."PaymentIntentPurpose" NOT NULL,
    status public."PaymentIntentStatus" DEFAULT 'PLANNED'::public."PaymentIntentStatus" NOT NULL,
    "amountCents" integer NOT NULL,
    currency character varying(3) NOT NULL,
    "externalProvider" text,
    "externalId" text,
    reference text,
    data jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: PaymentIntent_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."PaymentIntent_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: PaymentIntent_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."PaymentIntent_id_seq" OWNED BY public."PaymentIntent".id;


--
-- Name: PaymentMethod; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PaymentMethod" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "stripePaymentMethodId" text NOT NULL,
    type text NOT NULL,
    "cardBrand" text,
    "cardLast4" text,
    "cardExpMonth" integer,
    "cardExpYear" integer,
    "bankName" text,
    "bankLast4" text,
    "isDefault" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: PaymentMethod_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."PaymentMethod_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: PaymentMethod_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."PaymentMethod_id_seq" OWNED BY public."PaymentMethod".id;


--
-- Name: Payment_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Payment_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Payment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Payment_id_seq" OWNED BY public."Payment".id;


--
-- Name: PlanCodeCounter; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PlanCodeCounter" (
    "tenantId" integer NOT NULL,
    year integer NOT NULL,
    seq integer DEFAULT 0 NOT NULL
);


--
-- Name: PlanParty; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PlanParty" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "planId" integer NOT NULL,
    role text NOT NULL,
    "partyId" integer,
    notes text
);


--
-- Name: PlanParty_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."PlanParty_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: PlanParty_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."PlanParty_id_seq" OWNED BY public."PlanParty".id;


--
-- Name: PlatformSetting; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PlatformSetting" (
    id integer NOT NULL,
    namespace character varying(64) NOT NULL,
    data jsonb NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: PlatformSetting_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."PlatformSetting_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: PlatformSetting_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."PlatformSetting_id_seq" OWNED BY public."PlatformSetting".id;


--
-- Name: PortalAccess; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PortalAccess" (
    id integer NOT NULL,
    "partyId" integer NOT NULL,
    status public."PortalAccessStatus" DEFAULT 'NO_ACCESS'::public."PortalAccessStatus" NOT NULL,
    "userId" text,
    "invitedAt" timestamp(3) without time zone,
    "activatedAt" timestamp(3) without time zone,
    "suspendedAt" timestamp(3) without time zone,
    "lastLoginAt" timestamp(3) without time zone,
    "createdByUserId" text,
    "updatedByUserId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "tenantId" integer NOT NULL,
    "membershipUserId" text
);


--
-- Name: PortalAccess_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."PortalAccess_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: PortalAccess_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."PortalAccess_id_seq" OWNED BY public."PortalAccess".id;


--
-- Name: PortalInvite; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PortalInvite" (
    id integer NOT NULL,
    "tokenHash" text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "sentAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "usedAt" timestamp(3) without time zone,
    "sentByUserId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "tenantId" integer NOT NULL,
    "partyId" integer NOT NULL,
    "emailNorm" public.citext NOT NULL,
    "userId" text,
    "roleToGrant" public."TenantMembershipRole" DEFAULT 'CLIENT'::public."TenantMembershipRole" NOT NULL,
    "statusToGrant" public."TenantMembershipStatus" DEFAULT 'ACTIVE'::public."TenantMembershipStatus" NOT NULL,
    "membershipUserId" text,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: PortalInvite_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."PortalInvite_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: PortalInvite_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."PortalInvite_id_seq" OWNED BY public."PortalInvite".id;


--
-- Name: PregnancyCheck; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PregnancyCheck" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "planId" integer NOT NULL,
    method public."PregnancyCheckMethod" NOT NULL,
    result boolean NOT NULL,
    "checkedAt" timestamp(3) without time zone NOT NULL,
    notes text,
    data jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: PregnancyCheck_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."PregnancyCheck_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: PregnancyCheck_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."PregnancyCheck_id_seq" OWNED BY public."PregnancyCheck".id;


--
-- Name: Product; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Product" (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    type public."ProductType" NOT NULL,
    "billingInterval" public."BillingInterval",
    "stripeProductId" text,
    "stripePriceId" text,
    active boolean DEFAULT true NOT NULL,
    "priceUSD" integer NOT NULL,
    currency character varying(3) DEFAULT 'USD'::character varying NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    features jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: ProductEntitlement; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ProductEntitlement" (
    id integer NOT NULL,
    "productId" integer NOT NULL,
    "entitlementKey" public."EntitlementKey" NOT NULL,
    "limitValue" integer,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ProductEntitlement_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."ProductEntitlement_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ProductEntitlement_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."ProductEntitlement_id_seq" OWNED BY public."ProductEntitlement".id;


--
-- Name: Product_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Product_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Product_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Product_id_seq" OWNED BY public."Product".id;


--
-- Name: ProtocolComment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ProtocolComment" (
    id integer NOT NULL,
    "protocolId" integer NOT NULL,
    "tenantId" integer NOT NULL,
    content text NOT NULL,
    "parentId" integer,
    "authorName" text NOT NULL,
    "isHidden" boolean DEFAULT false NOT NULL,
    "hiddenAt" timestamp(3) without time zone,
    "hiddenBy" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: ProtocolComment_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."ProtocolComment_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ProtocolComment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."ProtocolComment_id_seq" OWNED BY public."ProtocolComment".id;


--
-- Name: ProtocolCopyRecord; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ProtocolCopyRecord" (
    id integer NOT NULL,
    "protocolId" integer NOT NULL,
    "tenantId" integer NOT NULL,
    "copiedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ProtocolCopyRecord_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."ProtocolCopyRecord_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ProtocolCopyRecord_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."ProtocolCopyRecord_id_seq" OWNED BY public."ProtocolCopyRecord".id;


--
-- Name: ProtocolRating; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ProtocolRating" (
    id integer NOT NULL,
    "protocolId" integer NOT NULL,
    "tenantId" integer NOT NULL,
    rating integer NOT NULL,
    review text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: ProtocolRating_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."ProtocolRating_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ProtocolRating_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."ProtocolRating_id_seq" OWNED BY public."ProtocolRating".id;


--
-- Name: RearingCertificate; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RearingCertificate" (
    id text NOT NULL,
    "tenantId" integer NOT NULL,
    "assignmentId" integer NOT NULL,
    "offspringId" integer NOT NULL,
    "offspringName" text NOT NULL,
    "protocolName" text NOT NULL,
    "breederName" text NOT NULL,
    "completedAt" timestamp(3) without time zone NOT NULL,
    "issuedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "isValid" boolean DEFAULT true NOT NULL,
    "revokedAt" timestamp(3) without time zone,
    "revokedReason" text,
    "buyerName" text,
    "buyerUserId" text,
    "certificateType" public."RearingCertificateType" DEFAULT 'FULL_PROTOCOL'::public."RearingCertificateType" NOT NULL,
    "stageCompleted" integer,
    "stageData" jsonb
);


--
-- Name: RearingProtocol; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RearingProtocol" (
    id integer NOT NULL,
    "tenantId" integer,
    name text NOT NULL,
    description text,
    species public."Species" NOT NULL,
    "isBenchmark" boolean DEFAULT false NOT NULL,
    "isPublic" boolean DEFAULT false NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    "parentProtocolId" integer,
    "isArchived" boolean DEFAULT false NOT NULL,
    "targetAgeStart" integer NOT NULL,
    "targetAgeEnd" integer NOT NULL,
    "estimatedDailyMinutes" integer,
    "breederName" text,
    rating double precision DEFAULT 0 NOT NULL,
    "ratingCount" integer DEFAULT 0 NOT NULL,
    "usageCount" integer DEFAULT 0 NOT NULL,
    "publishedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    "copiedAt" timestamp(3) without time zone,
    "originBreederName" text
);


--
-- Name: RearingProtocolActivity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RearingProtocolActivity" (
    id text NOT NULL,
    "stageId" text NOT NULL,
    name text NOT NULL,
    description text,
    instructions text,
    category public."ActivityCategory" NOT NULL,
    frequency public."ActivityFrequency" NOT NULL,
    "durationMinutes" integer,
    "isRequired" boolean DEFAULT true NOT NULL,
    "requiresEquipment" text[] DEFAULT ARRAY[]::text[],
    "order" integer NOT NULL,
    "checklistItems" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: RearingProtocolAssignment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RearingProtocolAssignment" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "protocolId" integer NOT NULL,
    "protocolVersion" integer NOT NULL,
    "protocolSnapshot" jsonb,
    "availableUpgrade" integer,
    "startDate" timestamp(3) without time zone NOT NULL,
    status public."RearingAssignmentStatus" DEFAULT 'ACTIVE'::public."RearingAssignmentStatus" NOT NULL,
    "acknowledgedDisclaimer" boolean DEFAULT false NOT NULL,
    "acknowledgedAt" timestamp(3) without time zone,
    "acknowledgedBy" text,
    "completedActivities" integer DEFAULT 0 NOT NULL,
    "totalActivities" integer DEFAULT 0 NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "animalId" integer,
    "handoffAt" timestamp(3) without time zone,
    "handoffByUserId" text,
    "handoffFromStage" integer,
    "handoffNotes" text,
    "handoffSnapshot" jsonb,
    "handoffToUserId" text,
    "offspringId" integer,
    "breedingPlanId" integer
);


--
-- Name: RearingProtocolAssignment_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."RearingProtocolAssignment_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: RearingProtocolAssignment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."RearingProtocolAssignment_id_seq" OWNED BY public."RearingProtocolAssignment".id;


--
-- Name: RearingProtocolStage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RearingProtocolStage" (
    id text NOT NULL,
    "protocolId" integer NOT NULL,
    name text NOT NULL,
    description text,
    "ageStartDays" integer NOT NULL,
    "ageEndDays" integer NOT NULL,
    "order" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: RearingProtocol_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."RearingProtocol_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: RearingProtocol_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."RearingProtocol_id_seq" OWNED BY public."RearingProtocol".id;


--
-- Name: Registry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Registry" (
    id integer NOT NULL,
    name text NOT NULL,
    code text,
    url text,
    country text,
    species public."Species",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: RegistryConnection; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RegistryConnection" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "registryId" integer NOT NULL,
    status public."RegistryConnectionStatus" DEFAULT 'DISCONNECTED'::public."RegistryConnectionStatus" NOT NULL,
    "accessToken" text,
    "refreshToken" text,
    "tokenExpiresAt" timestamp(3) without time zone,
    "apiKey" text,
    "apiSecret" text,
    "connectedAt" timestamp(3) without time zone,
    "lastSyncAt" timestamp(3) without time zone,
    "errorMessage" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: RegistryConnection_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."RegistryConnection_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: RegistryConnection_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."RegistryConnection_id_seq" OWNED BY public."RegistryConnection".id;


--
-- Name: RegistryPedigree; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RegistryPedigree" (
    id integer NOT NULL,
    "animalRegistryIdentifierId" integer NOT NULL,
    generation integer NOT NULL,
    "position" text NOT NULL,
    "registrationNumber" text,
    name text NOT NULL,
    color text,
    "birthYear" integer,
    sex text,
    "linkedAnimalId" integer,
    "rawData" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: RegistryPedigree_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."RegistryPedigree_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: RegistryPedigree_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."RegistryPedigree_id_seq" OWNED BY public."RegistryPedigree".id;


--
-- Name: RegistrySyncLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RegistrySyncLog" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "registryId" integer NOT NULL,
    action text NOT NULL,
    status text NOT NULL,
    "animalId" integer,
    identifier text,
    "requestData" jsonb,
    "responseData" jsonb,
    "errorMessage" text,
    "durationMs" integer,
    "initiatedByUserId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: RegistrySyncLog_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."RegistrySyncLog_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: RegistrySyncLog_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."RegistrySyncLog_id_seq" OWNED BY public."RegistrySyncLog".id;


--
-- Name: RegistryVerification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RegistryVerification" (
    id integer NOT NULL,
    "animalRegistryIdentifierId" integer NOT NULL,
    verified boolean DEFAULT false NOT NULL,
    "verifiedAt" timestamp(3) without time zone,
    method public."VerificationMethod",
    confidence public."VerificationConfidence" DEFAULT 'NONE'::public."VerificationConfidence" NOT NULL,
    "registryData" jsonb,
    "documentUrl" text,
    "documentNotes" text,
    "verifiedByUserId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: RegistryVerification_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."RegistryVerification_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: RegistryVerification_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."RegistryVerification_id_seq" OWNED BY public."RegistryVerification".id;


--
-- Name: Registry_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Registry_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Registry_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Registry_id_seq" OWNED BY public."Registry".id;


--
-- Name: ReproductiveCycle; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ReproductiveCycle" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "femaleId" integer NOT NULL,
    "cycleStart" timestamp(3) without time zone NOT NULL,
    ovulation timestamp(3) without time zone,
    "dueDate" timestamp(3) without time zone,
    "placementStartDate" timestamp(3) without time zone,
    status text,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: ReproductiveCycle_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."ReproductiveCycle_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ReproductiveCycle_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."ReproductiveCycle_id_seq" OWNED BY public."ReproductiveCycle".id;


--
-- Name: SchedulingAvailabilityBlock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SchedulingAvailabilityBlock" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "templateId" integer,
    "startAt" timestamp(3) without time zone NOT NULL,
    "endAt" timestamp(3) without time zone NOT NULL,
    timezone character varying(64) DEFAULT 'America/New_York'::character varying NOT NULL,
    status public."SchedulingEventStatus" DEFAULT 'OPEN'::public."SchedulingEventStatus" NOT NULL,
    "canCancel" boolean,
    "canReschedule" boolean,
    "cancellationDeadlineHours" integer,
    "rescheduleDeadlineHours" integer,
    "nextStepsText" text,
    location text,
    "createdByUserId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "breedingPlanId" integer
);


--
-- Name: SchedulingAvailabilityBlock_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."SchedulingAvailabilityBlock_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: SchedulingAvailabilityBlock_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."SchedulingAvailabilityBlock_id_seq" OWNED BY public."SchedulingAvailabilityBlock".id;


--
-- Name: SchedulingBooking; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SchedulingBooking" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "slotId" integer NOT NULL,
    "partyId" integer NOT NULL,
    "eventId" character varying(64) NOT NULL,
    status public."SchedulingBookingStatus" DEFAULT 'CONFIRMED'::public."SchedulingBookingStatus" NOT NULL,
    "bookedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "cancelledAt" timestamp(3) without time zone,
    "rescheduledAt" timestamp(3) without time zone,
    "clientNotes" text,
    "breederNotes" text,
    "nextSteps" text,
    "rescheduledFromId" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: SchedulingBooking_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."SchedulingBooking_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: SchedulingBooking_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."SchedulingBooking_id_seq" OWNED BY public."SchedulingBooking".id;


--
-- Name: SchedulingEventTemplate; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SchedulingEventTemplate" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    name text NOT NULL,
    "eventType" text NOT NULL,
    description text,
    status public."SchedulingEventStatus" DEFAULT 'DRAFT'::public."SchedulingEventStatus" NOT NULL,
    "defaultDurationMinutes" integer DEFAULT 60 NOT NULL,
    "defaultCapacity" integer DEFAULT 1 NOT NULL,
    "canCancel" boolean DEFAULT true NOT NULL,
    "canReschedule" boolean DEFAULT true NOT NULL,
    "cancellationDeadlineHours" integer,
    "rescheduleDeadlineHours" integer,
    "nextStepsText" text,
    "subjectType" text,
    "offspringId" integer,
    "createdByUserId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: SchedulingEventTemplate_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."SchedulingEventTemplate_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: SchedulingEventTemplate_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."SchedulingEventTemplate_id_seq" OWNED BY public."SchedulingEventTemplate".id;


--
-- Name: SchedulingSlot; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SchedulingSlot" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "blockId" integer NOT NULL,
    "startsAt" timestamp(3) without time zone NOT NULL,
    "endsAt" timestamp(3) without time zone NOT NULL,
    capacity integer DEFAULT 1 NOT NULL,
    "bookedCount" integer DEFAULT 0 NOT NULL,
    status public."SchedulingSlotStatus" DEFAULT 'AVAILABLE'::public."SchedulingSlotStatus" NOT NULL,
    mode public."SchedulingSlotMode",
    location text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: SchedulingSlot_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."SchedulingSlot_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: SchedulingSlot_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."SchedulingSlot_id_seq" OWNED BY public."SchedulingSlot".id;


--
-- Name: SemenInventory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SemenInventory" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "stallionId" integer NOT NULL,
    "batchNumber" text NOT NULL,
    "collectionDate" timestamp(3) without time zone NOT NULL,
    "collectionMethod" public."SemenCollectionMethod" DEFAULT 'AV'::public."SemenCollectionMethod" NOT NULL,
    "storageType" public."SemenStorageType" NOT NULL,
    "storageLocation" text,
    "storageFacility" text,
    "initialDoses" integer NOT NULL,
    "availableDoses" integer NOT NULL,
    "doseVolumeMl" numeric(5,2),
    concentration integer,
    motility integer,
    morphology integer,
    "qualityGrade" public."SemenQualityGrade",
    "expiresAt" timestamp(3) without time zone,
    "isExpired" boolean DEFAULT false NOT NULL,
    status public."SemenInventoryStatus" DEFAULT 'AVAILABLE'::public."SemenInventoryStatus" NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "createdBy" integer,
    "archivedAt" timestamp(3) without time zone
);


--
-- Name: SemenInventory_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."SemenInventory_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: SemenInventory_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."SemenInventory_id_seq" OWNED BY public."SemenInventory".id;


--
-- Name: SemenUsage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SemenUsage" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "inventoryId" integer NOT NULL,
    "usageType" public."SemenUsageType" NOT NULL,
    "usageDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "dosesUsed" integer DEFAULT 1 NOT NULL,
    "breedingAttemptId" integer,
    "shippedToName" text,
    "shippedToAddress" text,
    "shippingCarrier" text,
    "trackingNumber" text,
    "transferredToFacility" text,
    notes text,
    "recordedBy" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: SemenUsage_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."SemenUsage_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: SemenUsage_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."SemenUsage_id_seq" OWNED BY public."SemenUsage".id;


--
-- Name: Sequence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Sequence" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    key text NOT NULL,
    year integer NOT NULL,
    "nextNumber" integer DEFAULT 1 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Sequence_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Sequence_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Sequence_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Sequence_id_seq" OWNED BY public."Sequence".id;


--
-- Name: Session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Session" (
    id text NOT NULL,
    "userId" text NOT NULL,
    expires timestamp(3) without time zone NOT NULL,
    "sessionToken" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: ShareCode; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ShareCode" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    code text NOT NULL,
    "animalIds" integer[],
    "defaultAccessTier" public."AnimalAccessTier" DEFAULT 'BASIC'::public."AnimalAccessTier" NOT NULL,
    "perAnimalTiers" jsonb,
    "expiresAt" timestamp(3) without time zone,
    "maxUses" integer,
    "useCount" integer DEFAULT 0 NOT NULL,
    status public."ShareCodeStatus" DEFAULT 'ACTIVE'::public."ShareCodeStatus" NOT NULL,
    "revokedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ShareCode_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."ShareCode_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ShareCode_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."ShareCode_id_seq" OWNED BY public."ShareCode".id;


--
-- Name: ShearingRecord; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ShearingRecord" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "animalId" integer NOT NULL,
    "shearingDate" date NOT NULL,
    "shearingType" public."ShearingType" DEFAULT 'FULL_BODY'::public."ShearingType" NOT NULL,
    "daysSinceLastShearing" integer,
    "grossWeightLbs" numeric(6,2) NOT NULL,
    "cleanWeightLbs" numeric(6,2),
    "yieldPct" numeric(5,2),
    "stapleLengthIn" numeric(4,2),
    grade public."FleeceGrade",
    "handleQuality" text,
    "crimpPerInch" numeric(4,1),
    "vegetableMatter" text,
    weathering text,
    cotting boolean,
    tenderness text,
    "soldTo" text,
    "salePriceCents" integer,
    "fiberBuyer" text,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: ShearingRecord_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."ShearingRecord_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ShearingRecord_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."ShearingRecord_id_seq" OWNED BY public."ShearingRecord".id;


--
-- Name: SignatureEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SignatureEvent" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "contractId" integer NOT NULL,
    "partyId" integer,
    status public."SignatureStatus" NOT NULL,
    at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "ipAddress" text,
    "userAgent" text,
    message text,
    data jsonb
);


--
-- Name: SignatureEvent_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."SignatureEvent_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: SignatureEvent_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."SignatureEvent_id_seq" OWNED BY public."SignatureEvent".id;


--
-- Name: StudVisibilityRule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."StudVisibilityRule" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    level public."StudVisibilityLevel" NOT NULL,
    "levelId" character varying(50) NOT NULL,
    "inheritsFromId" integer,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "createdBy" integer,
    "updatedBy" integer
);


--
-- Name: StudVisibilityRule_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."StudVisibilityRule_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: StudVisibilityRule_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."StudVisibilityRule_id_seq" OWNED BY public."StudVisibilityRule".id;


--
-- Name: Subscription; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Subscription" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "productId" integer NOT NULL,
    status public."SubscriptionStatus" DEFAULT 'TRIAL'::public."SubscriptionStatus" NOT NULL,
    "stripeSubscriptionId" text,
    "stripeCustomerId" text,
    "currentPeriodStart" timestamp(3) without time zone,
    "currentPeriodEnd" timestamp(3) without time zone,
    "cancelAtPeriodEnd" boolean DEFAULT false NOT NULL,
    "canceledAt" timestamp(3) without time zone,
    "trialStart" timestamp(3) without time zone,
    "trialEnd" timestamp(3) without time zone,
    "amountCents" integer NOT NULL,
    currency character varying(3) DEFAULT 'USD'::character varying NOT NULL,
    "billingInterval" public."BillingInterval" NOT NULL,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: SubscriptionAddOn; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SubscriptionAddOn" (
    id integer NOT NULL,
    "subscriptionId" integer NOT NULL,
    "productId" integer NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    "amountCents" integer NOT NULL,
    "stripeItemId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: SubscriptionAddOn_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."SubscriptionAddOn_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: SubscriptionAddOn_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."SubscriptionAddOn_id_seq" OWNED BY public."SubscriptionAddOn".id;


--
-- Name: Subscription_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Subscription_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Subscription_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Subscription_id_seq" OWNED BY public."Subscription".id;


--
-- Name: SupplementAdministration; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SupplementAdministration" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "scheduleId" integer NOT NULL,
    "animalId" integer NOT NULL,
    "administeredAt" timestamp(3) without time zone NOT NULL,
    "actualDosage" text,
    "givenBy" text,
    "doseNumber" integer,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: SupplementAdministration_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."SupplementAdministration_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: SupplementAdministration_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."SupplementAdministration_id_seq" OWNED BY public."SupplementAdministration".id;


--
-- Name: SupplementProtocol; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SupplementProtocol" (
    id integer NOT NULL,
    "tenantId" integer,
    name text NOT NULL,
    description text,
    species public."Species"[],
    "isBenchmark" boolean DEFAULT false NOT NULL,
    "benchmarkSource" text,
    "benchmarkNotes" text,
    "dosageAmount" text,
    "dosageUnit" text,
    "administrationRoute" text,
    "triggerType" public."SupplementTriggerType" NOT NULL,
    "anchorEvent" public."BreedingCycleAnchorEvent",
    "offsetDays" integer,
    "ageTriggerWeeks" integer,
    "durationDays" integer,
    frequency public."SupplementFrequency" DEFAULT 'DAILY'::public."SupplementFrequency" NOT NULL,
    "reminderDaysBefore" integer[] DEFAULT ARRAY[7, 3, 1],
    active boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: SupplementProtocol_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."SupplementProtocol_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: SupplementProtocol_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."SupplementProtocol_id_seq" OWNED BY public."SupplementProtocol".id;


--
-- Name: SupplementSchedule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SupplementSchedule" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "protocolId" integer NOT NULL,
    "breedingPlanId" integer,
    "animalId" integer NOT NULL,
    mode public."SupplementScheduleMode" NOT NULL,
    "calculatedStartDate" timestamp(3) without time zone NOT NULL,
    "calculatedEndDate" timestamp(3) without time zone,
    "startDateOverride" timestamp(3) without time zone,
    "nextDueDate" timestamp(3) without time zone,
    status public."SupplementScheduleStatus" DEFAULT 'NOT_STARTED'::public."SupplementScheduleStatus" NOT NULL,
    "completedDoses" integer DEFAULT 0 NOT NULL,
    "totalDoses" integer,
    "lastAdministeredAt" timestamp(3) without time zone,
    "disclaimerAcknowledgedAt" timestamp(3) without time zone,
    "disclaimerAcknowledgedBy" text,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: SupplementSchedule_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."SupplementSchedule_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: SupplementSchedule_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."SupplementSchedule_id_seq" OWNED BY public."SupplementSchedule".id;


--
-- Name: Tag; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Tag" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    name text NOT NULL,
    module public."TagModule" NOT NULL,
    color text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "isArchived" boolean DEFAULT false NOT NULL,
    "archivedAt" timestamp(3) without time zone
);


--
-- Name: TagAssignment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TagAssignment" (
    id integer NOT NULL,
    "tagId" integer NOT NULL,
    "taggedPartyId" integer,
    "animalId" integer,
    "waitlistEntryId" integer,
    "offspringId" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "draftId" integer,
    "messageThreadId" integer,
    "breedingPlanId" integer,
    "buyerId" integer,
    "dealId" integer,
    "documentId" integer
);


--
-- Name: TagAssignment_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."TagAssignment_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: TagAssignment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."TagAssignment_id_seq" OWNED BY public."TagAssignment".id;


--
-- Name: Tag_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Tag_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Tag_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Tag_id_seq" OWNED BY public."Tag".id;


--
-- Name: Task; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Task" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    scope public."TaskScope" NOT NULL,
    "groupId" integer,
    "offspringId" integer,
    title text NOT NULL,
    notes text,
    "dueAt" timestamp(3) without time zone,
    status public."TaskStatus" DEFAULT 'open'::public."TaskStatus" NOT NULL,
    "assignedToUserId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Task_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Task_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Task_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Task_id_seq" OWNED BY public."Task".id;


--
-- Name: Template; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Template" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    name text NOT NULL,
    key text,
    channel public."TemplateChannel" NOT NULL,
    category public."TemplateCategory" NOT NULL,
    status public."TemplateStatus" DEFAULT 'draft'::public."TemplateStatus" NOT NULL,
    description text,
    "createdByPartyId" integer,
    "lastUsedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: TemplateContent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TemplateContent" (
    id integer NOT NULL,
    "templateId" integer NOT NULL,
    subject text,
    "bodyText" text NOT NULL,
    "bodyHtml" text,
    "metadataJson" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: TemplateContent_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."TemplateContent_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: TemplateContent_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."TemplateContent_id_seq" OWNED BY public."TemplateContent".id;


--
-- Name: Template_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Template_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Template_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Template_id_seq" OWNED BY public."Template".id;


--
-- Name: Tenant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Tenant" (
    id integer NOT NULL,
    name text NOT NULL,
    slug text,
    "primaryEmail" text,
    "operationType" public."TenantOperationType" DEFAULT 'HOBBY'::public."TenantOperationType" NOT NULL,
    "availabilityPrefs" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "avgBusinessHoursResponseTime" integer,
    "businessHours" jsonb,
    "lastBadgeEvaluatedAt" timestamp(3) without time zone,
    "quickResponderBadge" boolean DEFAULT false NOT NULL,
    "timeZone" text,
    "totalResponseCount" integer DEFAULT 0 NOT NULL,
    "inboundEmailSlug" text,
    "marketplacePaymentMode" text DEFAULT 'manual'::text NOT NULL,
    "stripeConnectAccountId" text,
    "stripeConnectOnboardingComplete" boolean DEFAULT false NOT NULL,
    "stripeConnectPayoutsEnabled" boolean DEFAULT false NOT NULL,
    "demoResetType" text,
    "isDemoTenant" boolean DEFAULT false NOT NULL,
    city text,
    country character(2),
    region text,
    "watermarkSettings" jsonb,
    "inquiryPermission" public."InquiryPermission" DEFAULT 'ANYONE'::public."InquiryPermission" NOT NULL,
    "networkVisibility" public."NetworkVisibility" DEFAULT 'VISIBLE'::public."NetworkVisibility" NOT NULL,
    "invoicingMode" text DEFAULT 'manual'::text NOT NULL,
    "paymentInstructions" text
);


--
-- Name: TenantMembership; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TenantMembership" (
    "userId" text NOT NULL,
    "tenantId" integer NOT NULL,
    role public."TenantRole" DEFAULT 'MEMBER'::public."TenantRole" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "membershipRole" public."TenantMembershipRole" DEFAULT 'STAFF'::public."TenantMembershipRole" NOT NULL,
    "membershipStatus" public."TenantMembershipStatus" DEFAULT 'ACTIVE'::public."TenantMembershipStatus" NOT NULL,
    "partyId" integer,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: TenantProgramBreed; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TenantProgramBreed" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    species public."Species" NOT NULL,
    "breedId" integer,
    "customBreedId" integer,
    "isPrimary" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: TenantProgramBreed_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."TenantProgramBreed_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: TenantProgramBreed_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."TenantProgramBreed_id_seq" OWNED BY public."TenantProgramBreed".id;


--
-- Name: TenantSetting; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TenantSetting" (
    "tenantId" integer NOT NULL,
    namespace text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    data jsonb NOT NULL,
    "updatedBy" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Tenant_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Tenant_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Tenant_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Tenant_id_seq" OWNED BY public."Tenant".id;


--
-- Name: TestResult; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TestResult" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "planId" integer,
    "animalId" integer,
    kind text NOT NULL,
    method text,
    "labName" text,
    "valueNumber" double precision,
    "valueText" text,
    units text,
    "referenceRange" text,
    "collectedAt" timestamp(3) without time zone NOT NULL,
    "resultAt" timestamp(3) without time zone,
    notes text,
    data jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "indicatesOvulationDate" timestamp(3) without time zone
);


--
-- Name: TestResult_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."TestResult_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: TestResult_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."TestResult_id_seq" OWNED BY public."TestResult".id;


--
-- Name: TitleDefinition; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TitleDefinition" (
    id integer NOT NULL,
    "tenantId" integer,
    species public."Species" NOT NULL,
    abbreviation text NOT NULL,
    "fullName" text NOT NULL,
    category public."TitleCategory" NOT NULL,
    organization text,
    "parentTitleId" integer,
    "pointsRequired" integer,
    description text,
    "isProducingTitle" boolean DEFAULT false NOT NULL,
    "prefixTitle" boolean DEFAULT true NOT NULL,
    "suffixTitle" boolean DEFAULT false NOT NULL,
    "displayOrder" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TitleDefinition_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."TitleDefinition_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: TitleDefinition_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."TitleDefinition_id_seq" OWNED BY public."TitleDefinition".id;


--
-- Name: TosAcceptance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TosAcceptance" (
    id integer NOT NULL,
    "userId" text NOT NULL,
    version character varying(16) NOT NULL,
    "acceptedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "ipAddress" character varying(45),
    "userAgent" text,
    surface character varying(32),
    flow character varying(32)
);


--
-- Name: TosAcceptance_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."TosAcceptance_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: TosAcceptance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."TosAcceptance_id_seq" OWNED BY public."TosAcceptance".id;


--
-- Name: TraitDefinition; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TraitDefinition" (
    id integer NOT NULL,
    "tenantId" integer,
    species public."Species" NOT NULL,
    key text NOT NULL,
    "displayName" text NOT NULL,
    category text NOT NULL,
    "valueType" public."TraitValueType" NOT NULL,
    "enumValues" jsonb,
    "requiresDocument" boolean DEFAULT false NOT NULL,
    "marketplaceVisibleDefault" boolean DEFAULT false NOT NULL,
    "sortOrder" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "supportsHistory" boolean DEFAULT false NOT NULL
);


--
-- Name: TraitDefinition_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."TraitDefinition_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: TraitDefinition_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."TraitDefinition_id_seq" OWNED BY public."TraitDefinition".id;


--
-- Name: UnlinkedEmail; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UnlinkedEmail" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "toAddresses" text[],
    "fromAddress" text NOT NULL,
    subject text NOT NULL,
    "bodyText" text,
    "bodyHtml" text,
    "bodyPreview" text,
    status text DEFAULT 'sent'::text NOT NULL,
    direction text DEFAULT 'outbound'::text NOT NULL,
    "sentAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "linkedPartyId" integer,
    "linkedAt" timestamp(3) without time zone,
    "messageId" text,
    "templateKey" text,
    category text DEFAULT 'transactional'::text NOT NULL,
    metadata jsonb,
    "createdBy" integer,
    "isRead" boolean DEFAULT false NOT NULL
);


--
-- Name: UnlinkedEmail_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."UnlinkedEmail_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: UnlinkedEmail_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."UnlinkedEmail_id_seq" OWNED BY public."UnlinkedEmail".id;


--
-- Name: UsageRecord; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UsageRecord" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "metricKey" public."UsageMetricKey" NOT NULL,
    value integer NOT NULL,
    "recordedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "userId" text,
    "resourceId" integer,
    metadata jsonb
);


--
-- Name: UsageRecord_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."UsageRecord_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: UsageRecord_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."UsageRecord_id_seq" OWNED BY public."UsageRecord".id;


--
-- Name: UsageSnapshot; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UsageSnapshot" (
    "tenantId" integer NOT NULL,
    "metricKey" public."UsageMetricKey" NOT NULL,
    "currentValue" integer NOT NULL,
    "limit" integer,
    "lastUpdatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    id text NOT NULL,
    email public.citext NOT NULL,
    name text,
    "firstName" text NOT NULL,
    "lastName" text NOT NULL,
    nickname text,
    image text,
    "passwordHash" text,
    "passwordUpdatedAt" timestamp(3) without time zone,
    "mustChangePassword" boolean DEFAULT false NOT NULL,
    "passwordSetAt" timestamp(3) without time zone,
    "lastPasswordChangeAt" timestamp(3) without time zone,
    "isSuperAdmin" boolean DEFAULT false NOT NULL,
    "emailVerifiedAt" timestamp(3) without time zone,
    "phoneE164" character varying(32),
    "whatsappE164" character varying(32),
    street text,
    street2 text,
    city text,
    state text,
    "postalCode" text,
    country character(2),
    "partyId" integer,
    "defaultTenantId" integer,
    "lastLoginAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    role text DEFAULT 'user'::text NOT NULL,
    "twoFactorEnabled" boolean DEFAULT false NOT NULL
);


--
-- Name: UserEntitlement; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserEntitlement" (
    id integer NOT NULL,
    "userId" text NOT NULL,
    key public."EntitlementKey" NOT NULL,
    status public."EntitlementStatus" DEFAULT 'ACTIVE'::public."EntitlementStatus" NOT NULL,
    "grantedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "revokedAt" timestamp(3) without time zone,
    "grantedByUserId" text
);


--
-- Name: UserEntitlement_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."UserEntitlement_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: UserEntitlement_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."UserEntitlement_id_seq" OWNED BY public."UserEntitlement".id;


--
-- Name: UserHelpPreference; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserHelpPreference" (
    id integer NOT NULL,
    "userId" text NOT NULL,
    "toursCompleted" text[] DEFAULT '{}'::text[] NOT NULL,
    "toursDismissed" text[] DEFAULT '{}'::text[] NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: UserHelpPreference_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."UserHelpPreference_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: UserHelpPreference_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."UserHelpPreference_id_seq" OWNED BY public."UserHelpPreference".id;


--
-- Name: UserNotificationPreferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserNotificationPreferences" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "userId" text NOT NULL,
    "vaccinationExpiring" boolean DEFAULT true NOT NULL,
    "vaccinationOverdue" boolean DEFAULT true NOT NULL,
    "breedingTimeline" boolean DEFAULT true NOT NULL,
    "pregnancyCheck" boolean DEFAULT true NOT NULL,
    "foalingApproaching" boolean DEFAULT true NOT NULL,
    "heatCycleExpected" boolean DEFAULT true NOT NULL,
    "marketplaceInquiry" boolean DEFAULT true NOT NULL,
    "waitlistSignup" boolean DEFAULT true NOT NULL,
    "emailEnabled" boolean DEFAULT true NOT NULL,
    "smsEnabled" boolean DEFAULT false NOT NULL,
    "pushEnabled" boolean DEFAULT true NOT NULL,
    "phoneNumber" text,
    "phoneVerified" boolean DEFAULT false NOT NULL,
    "phoneVerifiedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "microchipRenewal" boolean DEFAULT true NOT NULL,
    "geneticCarrierWarning" boolean DEFAULT true NOT NULL,
    "geneticIncomplete" boolean DEFAULT false NOT NULL,
    "geneticMissing" boolean DEFAULT false NOT NULL,
    "geneticPrebreeding" boolean DEFAULT true NOT NULL,
    "geneticRecommended" boolean DEFAULT false NOT NULL,
    "geneticRegistration" boolean DEFAULT true NOT NULL
);


--
-- Name: UserNotificationPreferences_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."UserNotificationPreferences_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: UserNotificationPreferences_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."UserNotificationPreferences_id_seq" OWNED BY public."UserNotificationPreferences".id;


--
-- Name: VaccinationRecord; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."VaccinationRecord" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "animalId" integer NOT NULL,
    "protocolKey" character varying(100) NOT NULL,
    "administeredAt" timestamp(3) without time zone NOT NULL,
    "expiresAt" timestamp(3) without time zone,
    veterinarian character varying(255),
    clinic character varying(255),
    "batchLotNumber" character varying(100),
    notes text,
    "documentId" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: VaccinationRecord_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."VaccinationRecord_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: VaccinationRecord_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."VaccinationRecord_id_seq" OWNED BY public."VaccinationRecord".id;


--
-- Name: VerificationToken; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."VerificationToken" (
    identifier text NOT NULL,
    token text,
    "tokenHash" text NOT NULL,
    purpose public."VerificationPurpose" DEFAULT 'VERIFY_EMAIL'::public."VerificationPurpose" NOT NULL,
    expires timestamp(3) without time zone NOT NULL,
    "userId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: WaitlistEntry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."WaitlistEntry" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "planId" integer,
    "litterId" integer,
    "clientPartyId" integer,
    "speciesPref" public."Species",
    "breedPrefs" jsonb,
    "sirePrefId" integer,
    "damPrefId" integer,
    status public."WaitlistStatus" DEFAULT 'INQUIRY'::public."WaitlistStatus" NOT NULL,
    priority integer,
    "balanceInvoiceId" text,
    "depositPaidAt" timestamp(3) without time zone,
    "depositRequiredCents" integer,
    "depositPaidCents" integer,
    "balanceDueCents" integer,
    "animalId" integer,
    "offspringId" integer,
    "skipCount" integer,
    "lastSkipAt" timestamp(3) without time zone,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "approvedAt" timestamp(3) without time zone,
    "rejectedAt" timestamp(3) without time zone,
    "rejectedReason" text,
    "depositInvoiceId" integer,
    "originPagePath" text,
    "originProgramSlug" text,
    "originReferrer" text,
    "originSource" text,
    "originUtmCampaign" text,
    "originUtmMedium" text,
    "originUtmSource" text,
    "programId" integer,
    "buyerId" integer,
    "buyerPreferences" jsonb DEFAULT '{}'::jsonb
);


--
-- Name: COLUMN "WaitlistEntry"."buyerPreferences"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."WaitlistEntry"."buyerPreferences" IS 'Structured buyer prefs: sexPref, purpose, colorPrefs, timeline, registrationRequired';


--
-- Name: WaitlistEntry_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."WaitlistEntry_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: WaitlistEntry_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."WaitlistEntry_id_seq" OWNED BY public."WaitlistEntry".id;


--
-- Name: WatermarkedAsset; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."WatermarkedAsset" (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "originalKey" text NOT NULL,
    "watermarkedKey" text NOT NULL,
    "settingsHash" character varying(32) NOT NULL,
    "mimeType" text NOT NULL,
    "sizeBytes" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: WatermarkedAsset_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."WatermarkedAsset_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: WatermarkedAsset_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."WatermarkedAsset_id_seq" OWNED BY public."WatermarkedAsset".id;


--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Name: animal_loci; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.animal_loci (
    id integer NOT NULL,
    animal_id integer NOT NULL,
    category text NOT NULL,
    locus text NOT NULL,
    locus_name text NOT NULL,
    allele1 text,
    allele2 text,
    genotype text,
    network_visible boolean DEFAULT false NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: animal_loci_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.animal_loci_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: animal_loci_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.animal_loci_id_seq OWNED BY public.animal_loci.id;


--
-- Name: devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.devices (
    id integer NOT NULL,
    "userId" text NOT NULL,
    "fcmToken" character varying(255) NOT NULL,
    platform character varying(10) NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: devices_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.devices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: devices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.devices_id_seq OWNED BY public.devices.id;


--
-- Name: mkt_listing_individual_animal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mkt_listing_individual_animal (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "animalId" integer NOT NULL,
    "templateType" character varying(32) NOT NULL,
    slug text NOT NULL,
    headline character varying(120),
    title character varying(100),
    summary text,
    description text,
    "dataDrawerConfig" jsonb NOT NULL,
    "listingContent" jsonb,
    "priceModel" character varying(32) NOT NULL,
    "priceCents" integer,
    "priceMinCents" integer,
    "priceMaxCents" integer,
    "locationCity" character varying(100),
    "locationRegion" character varying(100),
    "locationCountry" character varying(2),
    status public."MarketplaceListingStatus" DEFAULT 'DRAFT'::public."MarketplaceListingStatus" NOT NULL,
    listed boolean DEFAULT true NOT NULL,
    "publishedAt" timestamp(3) without time zone,
    "pausedAt" timestamp(3) without time zone,
    "viewCount" integer DEFAULT 0 NOT NULL,
    "inquiryCount" integer DEFAULT 0 NOT NULL,
    "lastViewedAt" timestamp(3) without time zone,
    "lastInquiryAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "bookingFeeCents" integer,
    "bookingsClosed" boolean DEFAULT false NOT NULL,
    "bookingsReceived" integer DEFAULT 0 NOT NULL,
    "breedingMethods" text[] DEFAULT ARRAY[]::text[],
    "defaultGuaranteeType" public."BreedingGuaranteeType",
    "healthCertRequired" boolean DEFAULT false NOT NULL,
    "maxBookings" integer,
    "requiredTests" text[] DEFAULT ARRAY[]::text[],
    "seasonEnd" timestamp(3) without time zone,
    "seasonName" character varying(100),
    "seasonStart" timestamp(3) without time zone,
    "locationZip" character varying(20),
    "coverImageUrl" character varying(500)
);


--
-- Name: direct_animal_listing_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.direct_animal_listing_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: direct_animal_listing_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.direct_animal_listing_id_seq OWNED BY public.mkt_listing_individual_animal.id;


--
-- Name: entity_activity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.entity_activity (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "entityType" character varying(50) NOT NULL,
    "entityId" integer NOT NULL,
    kind character varying(50) NOT NULL,
    category character varying(30) DEFAULT 'system'::character varying NOT NULL,
    title character varying(500) NOT NULL,
    description text,
    metadata jsonb,
    "actorId" character varying(64),
    "actorName" character varying(200),
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE entity_activity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.entity_activity IS 'Narrative activity timeline. All tiers. For entities without dedicated activity tables.';


--
-- Name: entity_activity_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.entity_activity_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: entity_activity_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.entity_activity_id_seq OWNED BY public.entity_activity.id;


--
-- Name: entity_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.entity_audit_log (
    id bigint NOT NULL,
    "tenantId" integer NOT NULL,
    "entityType" character varying(50) NOT NULL,
    "entityId" integer NOT NULL,
    action character varying(20) NOT NULL,
    "fieldName" character varying(100),
    "oldValue" text,
    "newValue" text,
    "changedBy" character varying(64) NOT NULL,
    "changedByName" character varying(200),
    "changeSource" character varying(30) DEFAULT 'PLATFORM'::character varying NOT NULL,
    ip character varying(45),
    "requestId" character varying(64),
    metadata jsonb,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE entity_audit_log; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.entity_audit_log IS 'Field-level change audit trail for compliance. Enterprise tier only.';


--
-- Name: entity_audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.entity_audit_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: entity_audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.entity_audit_log_id_seq OWNED BY public.entity_audit_log.id;


--
-- Name: mkt_breeding_booking_animal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mkt_breeding_booking_animal (
    id integer NOT NULL,
    "bookingId" integer NOT NULL,
    "animalId" integer NOT NULL,
    featured boolean DEFAULT false NOT NULL,
    "feeOverride" integer,
    "maxBookings" integer,
    "bookingsClosed" boolean DEFAULT false NOT NULL,
    "addedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: mkt_breeding_booking_animal_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.mkt_breeding_booking_animal_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: mkt_breeding_booking_animal_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.mkt_breeding_booking_animal_id_seq OWNED BY public.mkt_breeding_booking_animal.id;


--
-- Name: mkt_listing_breeding_booking; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mkt_listing_breeding_booking (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    slug text NOT NULL,
    headline character varying(120),
    description text,
    intent character varying(32) NOT NULL,
    "feeCents" integer,
    "feeDirection" character varying(32),
    "breedingMethods" text[] DEFAULT ARRAY[]::text[],
    "guaranteeType" character varying(32),
    "guaranteeTerms" text,
    "healthCertRequired" boolean DEFAULT false NOT NULL,
    "cogginsCurrent" boolean DEFAULT false NOT NULL,
    "cultureRequired" boolean DEFAULT false NOT NULL,
    "contractRequired" boolean DEFAULT false NOT NULL,
    "customRequirements" text[] DEFAULT ARRAY[]::text[],
    "availableFrom" timestamp(3) without time zone,
    "availableTo" timestamp(3) without time zone,
    "blackoutDates" text[] DEFAULT ARRAY[]::text[],
    "maxBookingsPerPeriod" integer,
    "acceptingInquiries" boolean DEFAULT true NOT NULL,
    status public."MarketplaceListingStatus" DEFAULT 'DRAFT'::public."MarketplaceListingStatus" NOT NULL,
    "publishedAt" timestamp(3) without time zone,
    "pausedAt" timestamp(3) without time zone,
    "viewCount" integer DEFAULT 0 NOT NULL,
    "inquiryCount" integer DEFAULT 0 NOT NULL,
    "lastViewedAt" timestamp(3) without time zone,
    "lastInquiryAt" timestamp(3) without time zone,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "coverImageUrl" character varying(500),
    "dataDrawerConfig" jsonb
);


--
-- Name: COLUMN mkt_listing_breeding_booking."dataDrawerConfig"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.mkt_listing_breeding_booking."dataDrawerConfig" IS 'Configuration for which animal data sections to display on marketplace listing';


--
-- Name: mkt_listing_breeding_service_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.mkt_listing_breeding_service_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: mkt_listing_breeding_service_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.mkt_listing_breeding_service_id_seq OWNED BY public.mkt_listing_breeding_booking.id;


--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refresh_tokens (
    id integer NOT NULL,
    "userId" text NOT NULL,
    "tokenHash" character varying(64) NOT NULL,
    "deviceId" character varying(255),
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "revokedAt" timestamp(3) without time zone
);


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.refresh_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.refresh_tokens_id_seq OWNED BY public.refresh_tokens.id;


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version character varying(255) NOT NULL
);


--
-- Name: abuse_reports id; Type: DEFAULT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.abuse_reports ALTER COLUMN id SET DEFAULT nextval('marketplace.abuse_reports_id_seq'::regclass);


--
-- Name: international_waitlist id; Type: DEFAULT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.international_waitlist ALTER COLUMN id SET DEFAULT nextval('marketplace.international_waitlist_id_seq'::regclass);


--
-- Name: invoices id; Type: DEFAULT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.invoices ALTER COLUMN id SET DEFAULT nextval('marketplace.invoices_id_seq'::regclass);


--
-- Name: message_threads id; Type: DEFAULT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.message_threads ALTER COLUMN id SET DEFAULT nextval('marketplace.message_threads_id_seq'::regclass);


--
-- Name: messages id; Type: DEFAULT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.messages ALTER COLUMN id SET DEFAULT nextval('marketplace.messages_id_seq'::regclass);


--
-- Name: mkt_listing_breeder_service id; Type: DEFAULT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.mkt_listing_breeder_service ALTER COLUMN id SET DEFAULT nextval('marketplace."MktListingService_id_seq"'::regclass);


--
-- Name: mobile_refresh_tokens id; Type: DEFAULT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.mobile_refresh_tokens ALTER COLUMN id SET DEFAULT nextval('marketplace.mobile_refresh_tokens_id_seq'::regclass);


--
-- Name: provider_reports id; Type: DEFAULT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.provider_reports ALTER COLUMN id SET DEFAULT nextval('marketplace.provider_reports_id_seq'::regclass);


--
-- Name: provider_terms_acceptance id; Type: DEFAULT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.provider_terms_acceptance ALTER COLUMN id SET DEFAULT nextval('marketplace.provider_terms_acceptance_id_seq'::regclass);


--
-- Name: providers id; Type: DEFAULT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.providers ALTER COLUMN id SET DEFAULT nextval('marketplace.providers_id_seq'::regclass);


--
-- Name: reviews id; Type: DEFAULT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.reviews ALTER COLUMN id SET DEFAULT nextval('marketplace.reviews_id_seq'::regclass);


--
-- Name: saved_listings id; Type: DEFAULT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.saved_listings ALTER COLUMN id SET DEFAULT nextval('marketplace.saved_listings_id_seq'::regclass);


--
-- Name: service_tags id; Type: DEFAULT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.service_tags ALTER COLUMN id SET DEFAULT nextval('marketplace.service_tags_id_seq'::regclass);


--
-- Name: stripe_identity_sessions id; Type: DEFAULT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.stripe_identity_sessions ALTER COLUMN id SET DEFAULT nextval('marketplace.stripe_identity_sessions_id_seq'::regclass);


--
-- Name: transactions id; Type: DEFAULT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.transactions ALTER COLUMN id SET DEFAULT nextval('marketplace.transactions_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.users ALTER COLUMN id SET DEFAULT nextval('marketplace.users_id_seq'::regclass);


--
-- Name: verification_requests id; Type: DEFAULT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.verification_requests ALTER COLUMN id SET DEFAULT nextval('marketplace.verification_requests_id_seq'::regclass);


--
-- Name: ActivityCompletion id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ActivityCompletion" ALTER COLUMN id SET DEFAULT nextval('public."ActivityCompletion_id_seq"'::regclass);


--
-- Name: Animal id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Animal" ALTER COLUMN id SET DEFAULT nextval('public."Animal_id_seq"'::regclass);


--
-- Name: AnimalAccess id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalAccess" ALTER COLUMN id SET DEFAULT nextval('public."AnimalAccess_id_seq"'::regclass);


--
-- Name: AnimalAccessConversation id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalAccessConversation" ALTER COLUMN id SET DEFAULT nextval('public."AnimalAccessConversation_id_seq"'::regclass);


--
-- Name: AnimalBreed id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalBreed" ALTER COLUMN id SET DEFAULT nextval('public."AnimalBreed_id_seq"'::regclass);


--
-- Name: AnimalBreedingProfile id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalBreedingProfile" ALTER COLUMN id SET DEFAULT nextval('public."AnimalBreedingProfile_id_seq"'::regclass);


--
-- Name: AnimalGenetics id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalGenetics" ALTER COLUMN id SET DEFAULT nextval('public."AnimalGenetics_id_seq"'::regclass);


--
-- Name: AnimalIdentityLink id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalIdentityLink" ALTER COLUMN id SET DEFAULT nextval('public."AnimalIdentityLink_id_seq"'::regclass);


--
-- Name: AnimalIncompatibility id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalIncompatibility" ALTER COLUMN id SET DEFAULT nextval('public."AnimalIncompatibility_id_seq"'::regclass);


--
-- Name: AnimalLinkRequest id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalLinkRequest" ALTER COLUMN id SET DEFAULT nextval('public."AnimalLinkRequest_id_seq"'::regclass);


--
-- Name: AnimalMicrochipRegistration id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalMicrochipRegistration" ALTER COLUMN id SET DEFAULT nextval('public."AnimalMicrochipRegistration_id_seq"'::regclass);


--
-- Name: AnimalOwner id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalOwner" ALTER COLUMN id SET DEFAULT nextval('public."AnimalOwner_id_seq"'::regclass);


--
-- Name: AnimalOwnershipChange id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalOwnershipChange" ALTER COLUMN id SET DEFAULT nextval('public."AnimalOwnershipChange_id_seq"'::regclass);


--
-- Name: AnimalPrivacySettings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalPrivacySettings" ALTER COLUMN id SET DEFAULT nextval('public."AnimalPrivacySettings_id_seq"'::regclass);


--
-- Name: AnimalProgramMedia id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalProgramMedia" ALTER COLUMN id SET DEFAULT nextval('public."AnimalProgramMedia_id_seq"'::regclass);


--
-- Name: AnimalProgramParticipant id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalProgramParticipant" ALTER COLUMN id SET DEFAULT nextval('public."AnimalProgramParticipant_id_seq"'::regclass);


--
-- Name: AnimalRegistryIdentifier id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalRegistryIdentifier" ALTER COLUMN id SET DEFAULT nextval('public."AnimalRegistryIdentifier_id_seq"'::regclass);


--
-- Name: AnimalTitle id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalTitle" ALTER COLUMN id SET DEFAULT nextval('public."AnimalTitle_id_seq"'::regclass);


--
-- Name: AnimalTitleDocument id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalTitleDocument" ALTER COLUMN id SET DEFAULT nextval('public."AnimalTitleDocument_id_seq"'::regclass);


--
-- Name: AnimalTraitEntry id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalTraitEntry" ALTER COLUMN id SET DEFAULT nextval('public."AnimalTraitEntry_id_seq"'::regclass);


--
-- Name: AnimalTraitValue id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalTraitValue" ALTER COLUMN id SET DEFAULT nextval('public."AnimalTraitValue_id_seq"'::regclass);


--
-- Name: AnimalTraitValueDocument id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalTraitValueDocument" ALTER COLUMN id SET DEFAULT nextval('public."AnimalTraitValueDocument_id_seq"'::regclass);


--
-- Name: AssessmentResult id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AssessmentResult" ALTER COLUMN id SET DEFAULT nextval('public."AssessmentResult_id_seq"'::regclass);


--
-- Name: AssignmentOffspringOverride id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AssignmentOffspringOverride" ALTER COLUMN id SET DEFAULT nextval('public."AssignmentOffspringOverride_id_seq"'::regclass);


--
-- Name: Attachment id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Attachment" ALTER COLUMN id SET DEFAULT nextval('public."Attachment_id_seq"'::regclass);


--
-- Name: AuditEvent id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditEvent" ALTER COLUMN id SET DEFAULT nextval('public."AuditEvent_id_seq"'::regclass);


--
-- Name: AutoReplyLog id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AutoReplyLog" ALTER COLUMN id SET DEFAULT nextval('public."AutoReplyLog_id_seq"'::regclass);


--
-- Name: AutoReplyRule id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AutoReplyRule" ALTER COLUMN id SET DEFAULT nextval('public."AutoReplyRule_id_seq"'::regclass);


--
-- Name: BillingAccount id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BillingAccount" ALTER COLUMN id SET DEFAULT nextval('public."BillingAccount_id_seq"'::regclass);


--
-- Name: BlockedEmail id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BlockedEmail" ALTER COLUMN id SET DEFAULT nextval('public."BlockedEmail_id_seq"'::regclass);


--
-- Name: Breed id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Breed" ALTER COLUMN id SET DEFAULT nextval('public."Breed_id_seq"'::regclass);


--
-- Name: BreederProfile id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreederProfile" ALTER COLUMN id SET DEFAULT nextval('public."BreederProfile_id_seq"'::regclass);


--
-- Name: BreederReport id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreederReport" ALTER COLUMN id SET DEFAULT nextval('public."BreederReport_id_seq"'::regclass);


--
-- Name: BreederReportFlag id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreederReportFlag" ALTER COLUMN id SET DEFAULT nextval('public."BreederReportFlag_id_seq"'::regclass);


--
-- Name: BreedingAttempt id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingAttempt" ALTER COLUMN id SET DEFAULT nextval('public."BreedingAttempt_id_seq"'::regclass);


--
-- Name: BreedingBooking id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingBooking" ALTER COLUMN id SET DEFAULT nextval('public."BreedingBooking_id_seq"'::regclass);


--
-- Name: BreedingDiscoveryProgram id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingDiscoveryProgram" ALTER COLUMN id SET DEFAULT nextval('public."BreedingDiscoveryProgram_id_seq"'::regclass);


--
-- Name: BreedingEvent id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingEvent" ALTER COLUMN id SET DEFAULT nextval('public."BreedingEvent_id_seq"'::regclass);


--
-- Name: BreedingGroup id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingGroup" ALTER COLUMN id SET DEFAULT nextval('public."BreedingGroup_id_seq"'::regclass);


--
-- Name: BreedingGroupMember id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingGroupMember" ALTER COLUMN id SET DEFAULT nextval('public."BreedingGroupMember_id_seq"'::regclass);


--
-- Name: BreedingInquiry id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingInquiry" ALTER COLUMN id SET DEFAULT nextval('public."BreedingInquiry_id_seq"'::regclass);


--
-- Name: BreedingListing id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingListing" ALTER COLUMN id SET DEFAULT nextval('public."BreedingListing_id_seq"'::regclass);


--
-- Name: BreedingMilestone id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingMilestone" ALTER COLUMN id SET DEFAULT nextval('public."BreedingMilestone_id_seq"'::regclass);


--
-- Name: BreedingPlan id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingPlan" ALTER COLUMN id SET DEFAULT nextval('public."BreedingPlan_id_seq"'::regclass);


--
-- Name: BreedingPlanBuyer id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingPlanBuyer" ALTER COLUMN id SET DEFAULT nextval('public."BreedingPlanBuyer_id_seq"'::regclass);


--
-- Name: BreedingPlanEvent id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingPlanEvent" ALTER COLUMN id SET DEFAULT nextval('public."BreedingPlanEvent_id_seq"'::regclass);


--
-- Name: BreedingPlanTempLog id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingPlanTempLog" ALTER COLUMN id SET DEFAULT nextval('public."BreedingPlanTempLog_id_seq"'::regclass);


--
-- Name: BreedingProgramInquiry id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingProgramInquiry" ALTER COLUMN id SET DEFAULT nextval('public."BreedingProgramInquiry_id_seq"'::regclass);


--
-- Name: BreedingProgramMedia id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingProgramMedia" ALTER COLUMN id SET DEFAULT nextval('public."BreedingProgramMedia_id_seq"'::regclass);


--
-- Name: BreedingProgramRule id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingProgramRule" ALTER COLUMN id SET DEFAULT nextval('public."BreedingProgramRule_id_seq"'::regclass);


--
-- Name: BreedingProgramRuleExecution id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingProgramRuleExecution" ALTER COLUMN id SET DEFAULT nextval('public."BreedingProgramRuleExecution_id_seq"'::regclass);


--
-- Name: Buyer id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Buyer" ALTER COLUMN id SET DEFAULT nextval('public."Buyer_id_seq"'::regclass);


--
-- Name: BuyerEmailTemplate id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BuyerEmailTemplate" ALTER COLUMN id SET DEFAULT nextval('public."BuyerEmailTemplate_id_seq"'::regclass);


--
-- Name: BuyerInterest id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BuyerInterest" ALTER COLUMN id SET DEFAULT nextval('public."BuyerInterest_id_seq"'::regclass);


--
-- Name: BuyerTask id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BuyerTask" ALTER COLUMN id SET DEFAULT nextval('public."BuyerTask_id_seq"'::regclass);


--
-- Name: Campaign id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Campaign" ALTER COLUMN id SET DEFAULT nextval('public."Campaign_id_seq"'::regclass);


--
-- Name: CampaignAttribution id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CampaignAttribution" ALTER COLUMN id SET DEFAULT nextval('public."CampaignAttribution_id_seq"'::regclass);


--
-- Name: CompetitionEntry id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CompetitionEntry" ALTER COLUMN id SET DEFAULT nextval('public."CompetitionEntry_id_seq"'::regclass);


--
-- Name: CompetitionEntryDocument id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CompetitionEntryDocument" ALTER COLUMN id SET DEFAULT nextval('public."CompetitionEntryDocument_id_seq"'::regclass);


--
-- Name: Contact id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Contact" ALTER COLUMN id SET DEFAULT nextval('public."Contact_id_seq"'::regclass);


--
-- Name: ContactChangeRequest id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ContactChangeRequest" ALTER COLUMN id SET DEFAULT nextval('public."ContactChangeRequest_id_seq"'::regclass);


--
-- Name: Contract id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Contract" ALTER COLUMN id SET DEFAULT nextval('public."Contract_id_seq"'::regclass);


--
-- Name: ContractContent id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ContractContent" ALTER COLUMN id SET DEFAULT nextval('public."ContractContent_id_seq"'::regclass);


--
-- Name: ContractParty id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ContractParty" ALTER COLUMN id SET DEFAULT nextval('public."ContractParty_id_seq"'::regclass);


--
-- Name: ContractTemplate id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ContractTemplate" ALTER COLUMN id SET DEFAULT nextval('public."ContractTemplate_id_seq"'::regclass);


--
-- Name: CrossTenantAnimalLink id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CrossTenantAnimalLink" ALTER COLUMN id SET DEFAULT nextval('public."CrossTenantAnimalLink_id_seq"'::regclass);


--
-- Name: CustomBreed id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CustomBreed" ALTER COLUMN id SET DEFAULT nextval('public."CustomBreed_id_seq"'::regclass);


--
-- Name: DHIATestRecord id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DHIATestRecord" ALTER COLUMN id SET DEFAULT nextval('public."DHIATestRecord_id_seq"'::regclass);


--
-- Name: DairyProductionHistory id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DairyProductionHistory" ALTER COLUMN id SET DEFAULT nextval('public."DairyProductionHistory_id_seq"'::regclass);


--
-- Name: Deal id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Deal" ALTER COLUMN id SET DEFAULT nextval('public."Deal_id_seq"'::regclass);


--
-- Name: DealActivity id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DealActivity" ALTER COLUMN id SET DEFAULT nextval('public."DealActivity_id_seq"'::regclass);


--
-- Name: Document id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Document" ALTER COLUMN id SET DEFAULT nextval('public."Document_id_seq"'::regclass);


--
-- Name: DocumentBundle id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DocumentBundle" ALTER COLUMN id SET DEFAULT nextval('public."DocumentBundle_id_seq"'::regclass);


--
-- Name: DocumentBundleItem id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DocumentBundleItem" ALTER COLUMN id SET DEFAULT nextval('public."DocumentBundleItem_id_seq"'::regclass);


--
-- Name: Draft id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Draft" ALTER COLUMN id SET DEFAULT nextval('public."Draft_id_seq"'::regclass);


--
-- Name: EmailChangeRequest id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EmailChangeRequest" ALTER COLUMN id SET DEFAULT nextval('public."EmailChangeRequest_id_seq"'::regclass);


--
-- Name: EmailFilter id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EmailFilter" ALTER COLUMN id SET DEFAULT nextval('public."EmailFilter_id_seq"'::regclass);


--
-- Name: EmailSendLog id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EmailSendLog" ALTER COLUMN id SET DEFAULT nextval('public."EmailSendLog_id_seq"'::regclass);


--
-- Name: Expense id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Expense" ALTER COLUMN id SET DEFAULT nextval('public."Expense_id_seq"'::regclass);


--
-- Name: Feature id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Feature" ALTER COLUMN id SET DEFAULT nextval('public."Feature_id_seq"'::regclass);


--
-- Name: FeatureCheck id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FeatureCheck" ALTER COLUMN id SET DEFAULT nextval('public."FeatureCheck_id_seq"'::regclass);


--
-- Name: FeatureCheckDaily id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FeatureCheckDaily" ALTER COLUMN id SET DEFAULT nextval('public."FeatureCheckDaily_id_seq"'::regclass);


--
-- Name: FeedingPlan id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FeedingPlan" ALTER COLUMN id SET DEFAULT nextval('public."FeedingPlan_id_seq"'::regclass);


--
-- Name: FeedingRecord id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FeedingRecord" ALTER COLUMN id SET DEFAULT nextval('public."FeedingRecord_id_seq"'::regclass);


--
-- Name: FiberLabTest id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FiberLabTest" ALTER COLUMN id SET DEFAULT nextval('public."FiberLabTest_id_seq"'::regclass);


--
-- Name: FiberProductionHistory id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FiberProductionHistory" ALTER COLUMN id SET DEFAULT nextval('public."FiberProductionHistory_id_seq"'::regclass);


--
-- Name: FoalingCheck id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FoalingCheck" ALTER COLUMN id SET DEFAULT nextval('public."FoalingCheck_id_seq"'::regclass);


--
-- Name: FoalingOutcome id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FoalingOutcome" ALTER COLUMN id SET DEFAULT nextval('public."FoalingOutcome_id_seq"'::regclass);


--
-- Name: FoodChange id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FoodChange" ALTER COLUMN id SET DEFAULT nextval('public."FoodChange_id_seq"'::regclass);


--
-- Name: FoodProduct id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FoodProduct" ALTER COLUMN id SET DEFAULT nextval('public."FoodProduct_id_seq"'::regclass);


--
-- Name: GeneticNotificationPreference id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GeneticNotificationPreference" ALTER COLUMN id SET DEFAULT nextval('public."GeneticNotificationPreference_id_seq"'::regclass);


--
-- Name: GeneticNotificationSnooze id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GeneticNotificationSnooze" ALTER COLUMN id SET DEFAULT nextval('public."GeneticNotificationSnooze_id_seq"'::regclass);


--
-- Name: GeneticsDisclaimerAcceptance id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GeneticsDisclaimerAcceptance" ALTER COLUMN id SET DEFAULT nextval('public."GeneticsDisclaimerAcceptance_id_seq"'::regclass);


--
-- Name: GlobalAnimalIdentifier id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GlobalAnimalIdentifier" ALTER COLUMN id SET DEFAULT nextval('public."GlobalAnimalIdentifier_id_seq"'::regclass);


--
-- Name: GlobalAnimalIdentity id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GlobalAnimalIdentity" ALTER COLUMN id SET DEFAULT nextval('public."GlobalAnimalIdentity_id_seq"'::regclass);


--
-- Name: HealthEvent id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."HealthEvent" ALTER COLUMN id SET DEFAULT nextval('public."HealthEvent_id_seq"'::regclass);


--
-- Name: HelpArticleEmbedding id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."HelpArticleEmbedding" ALTER COLUMN id SET DEFAULT nextval('public."HelpArticleEmbedding_id_seq"'::regclass);


--
-- Name: HelpQueryLog id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."HelpQueryLog" ALTER COLUMN id SET DEFAULT nextval('public."HelpQueryLog_id_seq"'::regclass);


--
-- Name: IdempotencyKey id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."IdempotencyKey" ALTER COLUMN id SET DEFAULT nextval('public."IdempotencyKey_id_seq"'::regclass);


--
-- Name: Invite id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invite" ALTER COLUMN id SET DEFAULT nextval('public."Invite_id_seq"'::regclass);


--
-- Name: Invoice id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invoice" ALTER COLUMN id SET DEFAULT nextval('public."Invoice_id_seq"'::regclass);


--
-- Name: InvoiceLineItem id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InvoiceLineItem" ALTER COLUMN id SET DEFAULT nextval('public."InvoiceLineItem_id_seq"'::regclass);


--
-- Name: LactationCycle id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LactationCycle" ALTER COLUMN id SET DEFAULT nextval('public."LactationCycle_id_seq"'::regclass);


--
-- Name: LinearAppraisal id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LinearAppraisal" ALTER COLUMN id SET DEFAULT nextval('public."LinearAppraisal_id_seq"'::regclass);


--
-- Name: ListingBoost id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ListingBoost" ALTER COLUMN id SET DEFAULT nextval('public."ListingBoost_id_seq"'::regclass);


--
-- Name: Litter id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Litter" ALTER COLUMN id SET DEFAULT nextval('public."Litter_id_seq"'::regclass);


--
-- Name: LitterEvent id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LitterEvent" ALTER COLUMN id SET DEFAULT nextval('public."LitterEvent_id_seq"'::regclass);


--
-- Name: MareReproductiveHistory id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MareReproductiveHistory" ALTER COLUMN id SET DEFAULT nextval('public."MareReproductiveHistory_id_seq"'::regclass);


--
-- Name: MarketplaceUserBlock id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MarketplaceUserBlock" ALTER COLUMN id SET DEFAULT nextval('public."MarketplaceUserBlock_id_seq"'::regclass);


--
-- Name: MarketplaceUserFlag id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MarketplaceUserFlag" ALTER COLUMN id SET DEFAULT nextval('public."MarketplaceUserFlag_id_seq"'::regclass);


--
-- Name: MediaAccessEvent id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MediaAccessEvent" ALTER COLUMN id SET DEFAULT nextval('public."MediaAccessEvent_id_seq"'::regclass);


--
-- Name: Message id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Message" ALTER COLUMN id SET DEFAULT nextval('public."Message_id_seq"'::regclass);


--
-- Name: MessageParticipant id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MessageParticipant" ALTER COLUMN id SET DEFAULT nextval('public."MessageParticipant_id_seq"'::regclass);


--
-- Name: MessageThread id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MessageThread" ALTER COLUMN id SET DEFAULT nextval('public."MessageThread_id_seq"'::regclass);


--
-- Name: MicrochipRegistry id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MicrochipRegistry" ALTER COLUMN id SET DEFAULT nextval('public."MicrochipRegistry_id_seq"'::regclass);


--
-- Name: MilkingRecord id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MilkingRecord" ALTER COLUMN id SET DEFAULT nextval('public."MilkingRecord_id_seq"'::regclass);


--
-- Name: NeonatalCareEntry id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."NeonatalCareEntry" ALTER COLUMN id SET DEFAULT nextval('public."NeonatalCareEntry_id_seq"'::regclass);


--
-- Name: NeonatalIntervention id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."NeonatalIntervention" ALTER COLUMN id SET DEFAULT nextval('public."NeonatalIntervention_id_seq"'::regclass);


--
-- Name: NetworkBreedingInquiry id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."NetworkBreedingInquiry" ALTER COLUMN id SET DEFAULT nextval('public."NetworkBreedingInquiry_id_seq"'::regclass);


--
-- Name: NetworkSearchIndex id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."NetworkSearchIndex" ALTER COLUMN id SET DEFAULT nextval('public."NetworkSearchIndex_id_seq"'::regclass);


--
-- Name: Notification id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification" ALTER COLUMN id SET DEFAULT nextval('public."Notification_id_seq"'::regclass);


--
-- Name: Offspring id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Offspring" ALTER COLUMN id SET DEFAULT nextval('public."Offspring_id_seq"'::regclass);


--
-- Name: OffspringContract id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OffspringContract" ALTER COLUMN id SET DEFAULT nextval('public."OffspringContract_id_seq"'::regclass);


--
-- Name: OffspringDocument id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OffspringDocument" ALTER COLUMN id SET DEFAULT nextval('public."OffspringDocument_id_seq"'::regclass);


--
-- Name: OffspringEvent id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OffspringEvent" ALTER COLUMN id SET DEFAULT nextval('public."OffspringEvent_id_seq"'::regclass);


--
-- Name: OffspringInvoiceLink id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OffspringInvoiceLink" ALTER COLUMN id SET DEFAULT nextval('public."OffspringInvoiceLink_id_seq"'::regclass);


--
-- Name: OffspringProtocolException id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OffspringProtocolException" ALTER COLUMN id SET DEFAULT nextval('public."OffspringProtocolException_id_seq"'::regclass);


--
-- Name: Organization id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Organization" ALTER COLUMN id SET DEFAULT nextval('public."Organization_id_seq"'::regclass);


--
-- Name: Party id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Party" ALTER COLUMN id SET DEFAULT nextval('public."Party_id_seq"'::regclass);


--
-- Name: PartyActivity id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PartyActivity" ALTER COLUMN id SET DEFAULT nextval('public."PartyActivity_id_seq"'::regclass);


--
-- Name: PartyCommPreference id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PartyCommPreference" ALTER COLUMN id SET DEFAULT nextval('public."PartyCommPreference_id_seq"'::regclass);


--
-- Name: PartyCommPreferenceEvent id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PartyCommPreferenceEvent" ALTER COLUMN id SET DEFAULT nextval('public."PartyCommPreferenceEvent_id_seq"'::regclass);


--
-- Name: PartyEmail id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PartyEmail" ALTER COLUMN id SET DEFAULT nextval('public."PartyEmail_id_seq"'::regclass);


--
-- Name: PartyEvent id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PartyEvent" ALTER COLUMN id SET DEFAULT nextval('public."PartyEvent_id_seq"'::regclass);


--
-- Name: PartyMilestone id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PartyMilestone" ALTER COLUMN id SET DEFAULT nextval('public."PartyMilestone_id_seq"'::regclass);


--
-- Name: PartyNote id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PartyNote" ALTER COLUMN id SET DEFAULT nextval('public."PartyNote_id_seq"'::regclass);


--
-- Name: Payment id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Payment" ALTER COLUMN id SET DEFAULT nextval('public."Payment_id_seq"'::regclass);


--
-- Name: PaymentIntent id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PaymentIntent" ALTER COLUMN id SET DEFAULT nextval('public."PaymentIntent_id_seq"'::regclass);


--
-- Name: PaymentMethod id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PaymentMethod" ALTER COLUMN id SET DEFAULT nextval('public."PaymentMethod_id_seq"'::regclass);


--
-- Name: PlanParty id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PlanParty" ALTER COLUMN id SET DEFAULT nextval('public."PlanParty_id_seq"'::regclass);


--
-- Name: PlatformSetting id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PlatformSetting" ALTER COLUMN id SET DEFAULT nextval('public."PlatformSetting_id_seq"'::regclass);


--
-- Name: PortalAccess id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PortalAccess" ALTER COLUMN id SET DEFAULT nextval('public."PortalAccess_id_seq"'::regclass);


--
-- Name: PortalInvite id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PortalInvite" ALTER COLUMN id SET DEFAULT nextval('public."PortalInvite_id_seq"'::regclass);


--
-- Name: PregnancyCheck id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PregnancyCheck" ALTER COLUMN id SET DEFAULT nextval('public."PregnancyCheck_id_seq"'::regclass);


--
-- Name: Product id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Product" ALTER COLUMN id SET DEFAULT nextval('public."Product_id_seq"'::regclass);


--
-- Name: ProductEntitlement id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProductEntitlement" ALTER COLUMN id SET DEFAULT nextval('public."ProductEntitlement_id_seq"'::regclass);


--
-- Name: ProtocolComment id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProtocolComment" ALTER COLUMN id SET DEFAULT nextval('public."ProtocolComment_id_seq"'::regclass);


--
-- Name: ProtocolCopyRecord id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProtocolCopyRecord" ALTER COLUMN id SET DEFAULT nextval('public."ProtocolCopyRecord_id_seq"'::regclass);


--
-- Name: ProtocolRating id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProtocolRating" ALTER COLUMN id SET DEFAULT nextval('public."ProtocolRating_id_seq"'::regclass);


--
-- Name: RearingProtocol id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RearingProtocol" ALTER COLUMN id SET DEFAULT nextval('public."RearingProtocol_id_seq"'::regclass);


--
-- Name: RearingProtocolAssignment id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RearingProtocolAssignment" ALTER COLUMN id SET DEFAULT nextval('public."RearingProtocolAssignment_id_seq"'::regclass);


--
-- Name: Registry id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Registry" ALTER COLUMN id SET DEFAULT nextval('public."Registry_id_seq"'::regclass);


--
-- Name: RegistryConnection id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RegistryConnection" ALTER COLUMN id SET DEFAULT nextval('public."RegistryConnection_id_seq"'::regclass);


--
-- Name: RegistryPedigree id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RegistryPedigree" ALTER COLUMN id SET DEFAULT nextval('public."RegistryPedigree_id_seq"'::regclass);


--
-- Name: RegistrySyncLog id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RegistrySyncLog" ALTER COLUMN id SET DEFAULT nextval('public."RegistrySyncLog_id_seq"'::regclass);


--
-- Name: RegistryVerification id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RegistryVerification" ALTER COLUMN id SET DEFAULT nextval('public."RegistryVerification_id_seq"'::regclass);


--
-- Name: ReproductiveCycle id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ReproductiveCycle" ALTER COLUMN id SET DEFAULT nextval('public."ReproductiveCycle_id_seq"'::regclass);


--
-- Name: SchedulingAvailabilityBlock id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SchedulingAvailabilityBlock" ALTER COLUMN id SET DEFAULT nextval('public."SchedulingAvailabilityBlock_id_seq"'::regclass);


--
-- Name: SchedulingBooking id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SchedulingBooking" ALTER COLUMN id SET DEFAULT nextval('public."SchedulingBooking_id_seq"'::regclass);


--
-- Name: SchedulingEventTemplate id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SchedulingEventTemplate" ALTER COLUMN id SET DEFAULT nextval('public."SchedulingEventTemplate_id_seq"'::regclass);


--
-- Name: SchedulingSlot id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SchedulingSlot" ALTER COLUMN id SET DEFAULT nextval('public."SchedulingSlot_id_seq"'::regclass);


--
-- Name: SemenInventory id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SemenInventory" ALTER COLUMN id SET DEFAULT nextval('public."SemenInventory_id_seq"'::regclass);


--
-- Name: SemenUsage id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SemenUsage" ALTER COLUMN id SET DEFAULT nextval('public."SemenUsage_id_seq"'::regclass);


--
-- Name: Sequence id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Sequence" ALTER COLUMN id SET DEFAULT nextval('public."Sequence_id_seq"'::regclass);


--
-- Name: ShareCode id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ShareCode" ALTER COLUMN id SET DEFAULT nextval('public."ShareCode_id_seq"'::regclass);


--
-- Name: ShearingRecord id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ShearingRecord" ALTER COLUMN id SET DEFAULT nextval('public."ShearingRecord_id_seq"'::regclass);


--
-- Name: SignatureEvent id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SignatureEvent" ALTER COLUMN id SET DEFAULT nextval('public."SignatureEvent_id_seq"'::regclass);


--
-- Name: StudVisibilityRule id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StudVisibilityRule" ALTER COLUMN id SET DEFAULT nextval('public."StudVisibilityRule_id_seq"'::regclass);


--
-- Name: Subscription id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Subscription" ALTER COLUMN id SET DEFAULT nextval('public."Subscription_id_seq"'::regclass);


--
-- Name: SubscriptionAddOn id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SubscriptionAddOn" ALTER COLUMN id SET DEFAULT nextval('public."SubscriptionAddOn_id_seq"'::regclass);


--
-- Name: SupplementAdministration id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SupplementAdministration" ALTER COLUMN id SET DEFAULT nextval('public."SupplementAdministration_id_seq"'::regclass);


--
-- Name: SupplementProtocol id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SupplementProtocol" ALTER COLUMN id SET DEFAULT nextval('public."SupplementProtocol_id_seq"'::regclass);


--
-- Name: SupplementSchedule id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SupplementSchedule" ALTER COLUMN id SET DEFAULT nextval('public."SupplementSchedule_id_seq"'::regclass);


--
-- Name: Tag id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Tag" ALTER COLUMN id SET DEFAULT nextval('public."Tag_id_seq"'::regclass);


--
-- Name: TagAssignment id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TagAssignment" ALTER COLUMN id SET DEFAULT nextval('public."TagAssignment_id_seq"'::regclass);


--
-- Name: Task id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Task" ALTER COLUMN id SET DEFAULT nextval('public."Task_id_seq"'::regclass);


--
-- Name: Template id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Template" ALTER COLUMN id SET DEFAULT nextval('public."Template_id_seq"'::regclass);


--
-- Name: TemplateContent id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TemplateContent" ALTER COLUMN id SET DEFAULT nextval('public."TemplateContent_id_seq"'::regclass);


--
-- Name: Tenant id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Tenant" ALTER COLUMN id SET DEFAULT nextval('public."Tenant_id_seq"'::regclass);


--
-- Name: TenantProgramBreed id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TenantProgramBreed" ALTER COLUMN id SET DEFAULT nextval('public."TenantProgramBreed_id_seq"'::regclass);


--
-- Name: TestResult id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TestResult" ALTER COLUMN id SET DEFAULT nextval('public."TestResult_id_seq"'::regclass);


--
-- Name: TitleDefinition id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TitleDefinition" ALTER COLUMN id SET DEFAULT nextval('public."TitleDefinition_id_seq"'::regclass);


--
-- Name: TosAcceptance id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TosAcceptance" ALTER COLUMN id SET DEFAULT nextval('public."TosAcceptance_id_seq"'::regclass);


--
-- Name: TraitDefinition id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TraitDefinition" ALTER COLUMN id SET DEFAULT nextval('public."TraitDefinition_id_seq"'::regclass);


--
-- Name: UnlinkedEmail id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UnlinkedEmail" ALTER COLUMN id SET DEFAULT nextval('public."UnlinkedEmail_id_seq"'::regclass);


--
-- Name: UsageRecord id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UsageRecord" ALTER COLUMN id SET DEFAULT nextval('public."UsageRecord_id_seq"'::regclass);


--
-- Name: UserEntitlement id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserEntitlement" ALTER COLUMN id SET DEFAULT nextval('public."UserEntitlement_id_seq"'::regclass);


--
-- Name: UserHelpPreference id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserHelpPreference" ALTER COLUMN id SET DEFAULT nextval('public."UserHelpPreference_id_seq"'::regclass);


--
-- Name: UserNotificationPreferences id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserNotificationPreferences" ALTER COLUMN id SET DEFAULT nextval('public."UserNotificationPreferences_id_seq"'::regclass);


--
-- Name: VaccinationRecord id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VaccinationRecord" ALTER COLUMN id SET DEFAULT nextval('public."VaccinationRecord_id_seq"'::regclass);


--
-- Name: WaitlistEntry id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WaitlistEntry" ALTER COLUMN id SET DEFAULT nextval('public."WaitlistEntry_id_seq"'::regclass);


--
-- Name: WatermarkedAsset id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WatermarkedAsset" ALTER COLUMN id SET DEFAULT nextval('public."WatermarkedAsset_id_seq"'::regclass);


--
-- Name: animal_loci id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.animal_loci ALTER COLUMN id SET DEFAULT nextval('public.animal_loci_id_seq'::regclass);


--
-- Name: devices id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices ALTER COLUMN id SET DEFAULT nextval('public.devices_id_seq'::regclass);


--
-- Name: entity_activity id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_activity ALTER COLUMN id SET DEFAULT nextval('public.entity_activity_id_seq'::regclass);


--
-- Name: entity_audit_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_audit_log ALTER COLUMN id SET DEFAULT nextval('public.entity_audit_log_id_seq'::regclass);


--
-- Name: mkt_breeding_booking_animal id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mkt_breeding_booking_animal ALTER COLUMN id SET DEFAULT nextval('public.mkt_breeding_booking_animal_id_seq'::regclass);


--
-- Name: mkt_listing_animal_program id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mkt_listing_animal_program ALTER COLUMN id SET DEFAULT nextval('public."AnimalProgram_id_seq"'::regclass);


--
-- Name: mkt_listing_breeding_booking id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mkt_listing_breeding_booking ALTER COLUMN id SET DEFAULT nextval('public.mkt_listing_breeding_service_id_seq'::regclass);


--
-- Name: mkt_listing_breeding_program id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mkt_listing_breeding_program ALTER COLUMN id SET DEFAULT nextval('public."BreedingProgram_id_seq"'::regclass);


--
-- Name: mkt_listing_individual_animal id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mkt_listing_individual_animal ALTER COLUMN id SET DEFAULT nextval('public.direct_animal_listing_id_seq'::regclass);


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('public.refresh_tokens_id_seq'::regclass);


--
-- Name: table_stats table_stats_pkey; Type: CONSTRAINT; Schema: _monitoring; Owner: -
--

ALTER TABLE ONLY _monitoring.table_stats
    ADD CONSTRAINT table_stats_pkey PRIMARY KEY (id);


--
-- Name: abuse_reports abuse_reports_pkey; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.abuse_reports
    ADD CONSTRAINT abuse_reports_pkey PRIMARY KEY (id);


--
-- Name: international_waitlist international_waitlist_pkey; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.international_waitlist
    ADD CONSTRAINT international_waitlist_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: message_threads message_threads_pkey; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.message_threads
    ADD CONSTRAINT message_threads_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: mkt_listing_breeder_service mkt_listing_breeder_service_pkey; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.mkt_listing_breeder_service
    ADD CONSTRAINT mkt_listing_breeder_service_pkey PRIMARY KEY (id);


--
-- Name: mkt_listing_breeder_service mkt_listing_breeder_service_slug_key; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.mkt_listing_breeder_service
    ADD CONSTRAINT mkt_listing_breeder_service_slug_key UNIQUE (slug);


--
-- Name: mobile_refresh_tokens mobile_refresh_tokens_pkey; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.mobile_refresh_tokens
    ADD CONSTRAINT mobile_refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: provider_reports provider_reports_pkey; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.provider_reports
    ADD CONSTRAINT provider_reports_pkey PRIMARY KEY (id);


--
-- Name: provider_terms_acceptance provider_terms_acceptance_pkey; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.provider_terms_acceptance
    ADD CONSTRAINT provider_terms_acceptance_pkey PRIMARY KEY (id);


--
-- Name: providers providers_pkey; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.providers
    ADD CONSTRAINT providers_pkey PRIMARY KEY (id);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: saved_listings saved_listings_pkey; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.saved_listings
    ADD CONSTRAINT saved_listings_pkey PRIMARY KEY (id);


--
-- Name: service_tag_assignments service_tag_assignments_pkey; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.service_tag_assignments
    ADD CONSTRAINT service_tag_assignments_pkey PRIMARY KEY (listing_id, tag_id);


--
-- Name: service_tags service_tags_pkey; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.service_tags
    ADD CONSTRAINT service_tags_pkey PRIMARY KEY (id);


--
-- Name: stripe_identity_sessions stripe_identity_sessions_pkey; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.stripe_identity_sessions
    ADD CONSTRAINT stripe_identity_sessions_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: verification_requests verification_requests_pkey; Type: CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.verification_requests
    ADD CONSTRAINT verification_requests_pkey PRIMARY KEY (id);


--
-- Name: ActivityCompletion ActivityCompletion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ActivityCompletion"
    ADD CONSTRAINT "ActivityCompletion_pkey" PRIMARY KEY (id);


--
-- Name: AnimalAccessConversation AnimalAccessConversation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalAccessConversation"
    ADD CONSTRAINT "AnimalAccessConversation_pkey" PRIMARY KEY (id);


--
-- Name: AnimalAccess AnimalAccess_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalAccess"
    ADD CONSTRAINT "AnimalAccess_pkey" PRIMARY KEY (id);


--
-- Name: AnimalBreed AnimalBreed_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalBreed"
    ADD CONSTRAINT "AnimalBreed_pkey" PRIMARY KEY (id);


--
-- Name: AnimalBreedingProfile AnimalBreedingProfile_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalBreedingProfile"
    ADD CONSTRAINT "AnimalBreedingProfile_pkey" PRIMARY KEY (id);


--
-- Name: AnimalGenetics AnimalGenetics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalGenetics"
    ADD CONSTRAINT "AnimalGenetics_pkey" PRIMARY KEY (id);


--
-- Name: AnimalIdentityLink AnimalIdentityLink_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalIdentityLink"
    ADD CONSTRAINT "AnimalIdentityLink_pkey" PRIMARY KEY (id);


--
-- Name: AnimalIncompatibility AnimalIncompatibility_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalIncompatibility"
    ADD CONSTRAINT "AnimalIncompatibility_pkey" PRIMARY KEY (id);


--
-- Name: AnimalLinkRequest AnimalLinkRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalLinkRequest"
    ADD CONSTRAINT "AnimalLinkRequest_pkey" PRIMARY KEY (id);


--
-- Name: AnimalMicrochipRegistration AnimalMicrochipRegistration_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalMicrochipRegistration"
    ADD CONSTRAINT "AnimalMicrochipRegistration_pkey" PRIMARY KEY (id);


--
-- Name: AnimalOwner AnimalOwner_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalOwner"
    ADD CONSTRAINT "AnimalOwner_pkey" PRIMARY KEY (id);


--
-- Name: AnimalOwnershipChange AnimalOwnershipChange_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalOwnershipChange"
    ADD CONSTRAINT "AnimalOwnershipChange_pkey" PRIMARY KEY (id);


--
-- Name: AnimalPrivacySettings AnimalPrivacySettings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalPrivacySettings"
    ADD CONSTRAINT "AnimalPrivacySettings_pkey" PRIMARY KEY (id);


--
-- Name: AnimalProgramMedia AnimalProgramMedia_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalProgramMedia"
    ADD CONSTRAINT "AnimalProgramMedia_pkey" PRIMARY KEY (id);


--
-- Name: AnimalProgramParticipant AnimalProgramParticipant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalProgramParticipant"
    ADD CONSTRAINT "AnimalProgramParticipant_pkey" PRIMARY KEY (id);


--
-- Name: AnimalRegistryIdentifier AnimalRegistryIdentifier_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalRegistryIdentifier"
    ADD CONSTRAINT "AnimalRegistryIdentifier_pkey" PRIMARY KEY (id);


--
-- Name: AnimalTitleDocument AnimalTitleDocument_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalTitleDocument"
    ADD CONSTRAINT "AnimalTitleDocument_pkey" PRIMARY KEY (id);


--
-- Name: AnimalTitle AnimalTitle_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalTitle"
    ADD CONSTRAINT "AnimalTitle_pkey" PRIMARY KEY (id);


--
-- Name: AnimalTraitEntry AnimalTraitEntry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalTraitEntry"
    ADD CONSTRAINT "AnimalTraitEntry_pkey" PRIMARY KEY (id);


--
-- Name: AnimalTraitValueDocument AnimalTraitValueDocument_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalTraitValueDocument"
    ADD CONSTRAINT "AnimalTraitValueDocument_pkey" PRIMARY KEY (id);


--
-- Name: AnimalTraitValue AnimalTraitValue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalTraitValue"
    ADD CONSTRAINT "AnimalTraitValue_pkey" PRIMARY KEY (id);


--
-- Name: Animal Animal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Animal"
    ADD CONSTRAINT "Animal_pkey" PRIMARY KEY (id);


--
-- Name: AssessmentResult AssessmentResult_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AssessmentResult"
    ADD CONSTRAINT "AssessmentResult_pkey" PRIMARY KEY (id);


--
-- Name: AssignmentOffspringOverride AssignmentOffspringOverride_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AssignmentOffspringOverride"
    ADD CONSTRAINT "AssignmentOffspringOverride_pkey" PRIMARY KEY (id);


--
-- Name: Attachment Attachment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Attachment"
    ADD CONSTRAINT "Attachment_pkey" PRIMARY KEY (id);


--
-- Name: AuditEvent AuditEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditEvent"
    ADD CONSTRAINT "AuditEvent_pkey" PRIMARY KEY (id);


--
-- Name: AutoReplyLog AutoReplyLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AutoReplyLog"
    ADD CONSTRAINT "AutoReplyLog_pkey" PRIMARY KEY (id);


--
-- Name: AutoReplyRule AutoReplyRule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AutoReplyRule"
    ADD CONSTRAINT "AutoReplyRule_pkey" PRIMARY KEY (id);


--
-- Name: BillingAccount BillingAccount_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BillingAccount"
    ADD CONSTRAINT "BillingAccount_pkey" PRIMARY KEY (id);


--
-- Name: BlockedEmail BlockedEmail_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BlockedEmail"
    ADD CONSTRAINT "BlockedEmail_pkey" PRIMARY KEY (id);


--
-- Name: BreedRegistryLink BreedRegistryLink_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedRegistryLink"
    ADD CONSTRAINT "BreedRegistryLink_pkey" PRIMARY KEY ("breedId", "registryId");


--
-- Name: Breed Breed_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Breed"
    ADD CONSTRAINT "Breed_pkey" PRIMARY KEY (id);


--
-- Name: BreederProfile BreederProfile_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreederProfile"
    ADD CONSTRAINT "BreederProfile_pkey" PRIMARY KEY (id);


--
-- Name: BreederReportFlag BreederReportFlag_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreederReportFlag"
    ADD CONSTRAINT "BreederReportFlag_pkey" PRIMARY KEY (id);


--
-- Name: BreederReport BreederReport_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreederReport"
    ADD CONSTRAINT "BreederReport_pkey" PRIMARY KEY (id);


--
-- Name: BreedingAttempt BreedingAttempt_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingAttempt"
    ADD CONSTRAINT "BreedingAttempt_pkey" PRIMARY KEY (id);


--
-- Name: BreedingBooking BreedingBooking_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingBooking"
    ADD CONSTRAINT "BreedingBooking_pkey" PRIMARY KEY (id);


--
-- Name: BreedingDataAgreement BreedingDataAgreement_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingDataAgreement"
    ADD CONSTRAINT "BreedingDataAgreement_pkey" PRIMARY KEY (id);


--
-- Name: BreedingDiscoveryProgram BreedingDiscoveryProgram_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingDiscoveryProgram"
    ADD CONSTRAINT "BreedingDiscoveryProgram_pkey" PRIMARY KEY (id);


--
-- Name: BreedingEvent BreedingEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingEvent"
    ADD CONSTRAINT "BreedingEvent_pkey" PRIMARY KEY (id);


--
-- Name: BreedingGroupMember BreedingGroupMember_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingGroupMember"
    ADD CONSTRAINT "BreedingGroupMember_pkey" PRIMARY KEY (id);


--
-- Name: BreedingGroup BreedingGroup_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingGroup"
    ADD CONSTRAINT "BreedingGroup_pkey" PRIMARY KEY (id);


--
-- Name: BreedingInquiry BreedingInquiry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingInquiry"
    ADD CONSTRAINT "BreedingInquiry_pkey" PRIMARY KEY (id);


--
-- Name: BreedingListing BreedingListing_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingListing"
    ADD CONSTRAINT "BreedingListing_pkey" PRIMARY KEY (id);


--
-- Name: BreedingMilestone BreedingMilestone_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingMilestone"
    ADD CONSTRAINT "BreedingMilestone_pkey" PRIMARY KEY (id);


--
-- Name: BreedingPlanBuyer BreedingPlanBuyer_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingPlanBuyer"
    ADD CONSTRAINT "BreedingPlanBuyer_pkey" PRIMARY KEY (id);


--
-- Name: BreedingPlanEvent BreedingPlanEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingPlanEvent"
    ADD CONSTRAINT "BreedingPlanEvent_pkey" PRIMARY KEY (id);


--
-- Name: BreedingPlanTempLog BreedingPlanTempLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingPlanTempLog"
    ADD CONSTRAINT "BreedingPlanTempLog_pkey" PRIMARY KEY (id);


--
-- Name: BreedingPlan BreedingPlan_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingPlan"
    ADD CONSTRAINT "BreedingPlan_pkey" PRIMARY KEY (id);


--
-- Name: BreedingProgramInquiry BreedingProgramInquiry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingProgramInquiry"
    ADD CONSTRAINT "BreedingProgramInquiry_pkey" PRIMARY KEY (id);


--
-- Name: BreedingProgramMedia BreedingProgramMedia_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingProgramMedia"
    ADD CONSTRAINT "BreedingProgramMedia_pkey" PRIMARY KEY (id);


--
-- Name: BreedingProgramRuleExecution BreedingProgramRuleExecution_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingProgramRuleExecution"
    ADD CONSTRAINT "BreedingProgramRuleExecution_pkey" PRIMARY KEY (id);


--
-- Name: BreedingProgramRule BreedingProgramRule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingProgramRule"
    ADD CONSTRAINT "BreedingProgramRule_pkey" PRIMARY KEY (id);


--
-- Name: BuyerEmailTemplate BuyerEmailTemplate_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BuyerEmailTemplate"
    ADD CONSTRAINT "BuyerEmailTemplate_pkey" PRIMARY KEY (id);


--
-- Name: BuyerInterest BuyerInterest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BuyerInterest"
    ADD CONSTRAINT "BuyerInterest_pkey" PRIMARY KEY (id);


--
-- Name: BuyerTask BuyerTask_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BuyerTask"
    ADD CONSTRAINT "BuyerTask_pkey" PRIMARY KEY (id);


--
-- Name: Buyer Buyer_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Buyer"
    ADD CONSTRAINT "Buyer_pkey" PRIMARY KEY (id);


--
-- Name: CampaignAttribution CampaignAttribution_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CampaignAttribution"
    ADD CONSTRAINT "CampaignAttribution_pkey" PRIMARY KEY (id);


--
-- Name: Campaign Campaign_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Campaign"
    ADD CONSTRAINT "Campaign_pkey" PRIMARY KEY (id);


--
-- Name: CompetitionEntryDocument CompetitionEntryDocument_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CompetitionEntryDocument"
    ADD CONSTRAINT "CompetitionEntryDocument_pkey" PRIMARY KEY (id);


--
-- Name: CompetitionEntry CompetitionEntry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CompetitionEntry"
    ADD CONSTRAINT "CompetitionEntry_pkey" PRIMARY KEY (id);


--
-- Name: ContactChangeRequest ContactChangeRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ContactChangeRequest"
    ADD CONSTRAINT "ContactChangeRequest_pkey" PRIMARY KEY (id);


--
-- Name: Contact Contact_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Contact"
    ADD CONSTRAINT "Contact_pkey" PRIMARY KEY (id);


--
-- Name: ContractContent ContractContent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ContractContent"
    ADD CONSTRAINT "ContractContent_pkey" PRIMARY KEY (id);


--
-- Name: ContractParty ContractParty_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ContractParty"
    ADD CONSTRAINT "ContractParty_pkey" PRIMARY KEY (id);


--
-- Name: ContractTemplate ContractTemplate_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ContractTemplate"
    ADD CONSTRAINT "ContractTemplate_pkey" PRIMARY KEY (id);


--
-- Name: Contract Contract_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Contract"
    ADD CONSTRAINT "Contract_pkey" PRIMARY KEY (id);


--
-- Name: CrossTenantAnimalLink CrossTenantAnimalLink_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CrossTenantAnimalLink"
    ADD CONSTRAINT "CrossTenantAnimalLink_pkey" PRIMARY KEY (id);


--
-- Name: CustomBreed CustomBreed_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CustomBreed"
    ADD CONSTRAINT "CustomBreed_pkey" PRIMARY KEY (id);


--
-- Name: DHIATestRecord DHIATestRecord_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DHIATestRecord"
    ADD CONSTRAINT "DHIATestRecord_pkey" PRIMARY KEY (id);


--
-- Name: DairyProductionHistory DairyProductionHistory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DairyProductionHistory"
    ADD CONSTRAINT "DairyProductionHistory_pkey" PRIMARY KEY (id);


--
-- Name: DealActivity DealActivity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DealActivity"
    ADD CONSTRAINT "DealActivity_pkey" PRIMARY KEY (id);


--
-- Name: Deal Deal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Deal"
    ADD CONSTRAINT "Deal_pkey" PRIMARY KEY (id);


--
-- Name: DocumentBundleItem DocumentBundleItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DocumentBundleItem"
    ADD CONSTRAINT "DocumentBundleItem_pkey" PRIMARY KEY (id);


--
-- Name: DocumentBundle DocumentBundle_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DocumentBundle"
    ADD CONSTRAINT "DocumentBundle_pkey" PRIMARY KEY (id);


--
-- Name: Document Document_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Document"
    ADD CONSTRAINT "Document_pkey" PRIMARY KEY (id);


--
-- Name: Draft Draft_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Draft"
    ADD CONSTRAINT "Draft_pkey" PRIMARY KEY (id);


--
-- Name: EmailChangeRequest EmailChangeRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EmailChangeRequest"
    ADD CONSTRAINT "EmailChangeRequest_pkey" PRIMARY KEY (id);


--
-- Name: EmailFilter EmailFilter_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EmailFilter"
    ADD CONSTRAINT "EmailFilter_pkey" PRIMARY KEY (id);


--
-- Name: EmailSendLog EmailSendLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EmailSendLog"
    ADD CONSTRAINT "EmailSendLog_pkey" PRIMARY KEY (id);


--
-- Name: Expense Expense_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Expense"
    ADD CONSTRAINT "Expense_pkey" PRIMARY KEY (id);


--
-- Name: FeatureCheckDaily FeatureCheckDaily_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FeatureCheckDaily"
    ADD CONSTRAINT "FeatureCheckDaily_pkey" PRIMARY KEY (id);


--
-- Name: FeatureCheck FeatureCheck_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FeatureCheck"
    ADD CONSTRAINT "FeatureCheck_pkey" PRIMARY KEY (id);


--
-- Name: Feature Feature_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Feature"
    ADD CONSTRAINT "Feature_pkey" PRIMARY KEY (id);


--
-- Name: FeedingPlan FeedingPlan_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FeedingPlan"
    ADD CONSTRAINT "FeedingPlan_pkey" PRIMARY KEY (id);


--
-- Name: FeedingRecord FeedingRecord_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FeedingRecord"
    ADD CONSTRAINT "FeedingRecord_pkey" PRIMARY KEY (id);


--
-- Name: FiberLabTest FiberLabTest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FiberLabTest"
    ADD CONSTRAINT "FiberLabTest_pkey" PRIMARY KEY (id);


--
-- Name: FiberProductionHistory FiberProductionHistory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FiberProductionHistory"
    ADD CONSTRAINT "FiberProductionHistory_pkey" PRIMARY KEY (id);


--
-- Name: FoalingCheck FoalingCheck_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FoalingCheck"
    ADD CONSTRAINT "FoalingCheck_pkey" PRIMARY KEY (id);


--
-- Name: FoalingOutcome FoalingOutcome_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FoalingOutcome"
    ADD CONSTRAINT "FoalingOutcome_pkey" PRIMARY KEY (id);


--
-- Name: FoodChange FoodChange_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FoodChange"
    ADD CONSTRAINT "FoodChange_pkey" PRIMARY KEY (id);


--
-- Name: FoodProduct FoodProduct_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FoodProduct"
    ADD CONSTRAINT "FoodProduct_pkey" PRIMARY KEY (id);


--
-- Name: GeneticNotificationPreference GeneticNotificationPreference_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GeneticNotificationPreference"
    ADD CONSTRAINT "GeneticNotificationPreference_pkey" PRIMARY KEY (id);


--
-- Name: GeneticNotificationSnooze GeneticNotificationSnooze_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GeneticNotificationSnooze"
    ADD CONSTRAINT "GeneticNotificationSnooze_pkey" PRIMARY KEY (id);


--
-- Name: GeneticsDisclaimerAcceptance GeneticsDisclaimerAcceptance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GeneticsDisclaimerAcceptance"
    ADD CONSTRAINT "GeneticsDisclaimerAcceptance_pkey" PRIMARY KEY (id);


--
-- Name: GlobalAnimalIdentifier GlobalAnimalIdentifier_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GlobalAnimalIdentifier"
    ADD CONSTRAINT "GlobalAnimalIdentifier_pkey" PRIMARY KEY (id);


--
-- Name: GlobalAnimalIdentity GlobalAnimalIdentity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GlobalAnimalIdentity"
    ADD CONSTRAINT "GlobalAnimalIdentity_pkey" PRIMARY KEY (id);


--
-- Name: HealthEvent HealthEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."HealthEvent"
    ADD CONSTRAINT "HealthEvent_pkey" PRIMARY KEY (id);


--
-- Name: HelpArticleEmbedding HelpArticleEmbedding_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."HelpArticleEmbedding"
    ADD CONSTRAINT "HelpArticleEmbedding_pkey" PRIMARY KEY (id);


--
-- Name: HelpArticleEmbedding HelpArticleEmbedding_slug_chunkIndex_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."HelpArticleEmbedding"
    ADD CONSTRAINT "HelpArticleEmbedding_slug_chunkIndex_key" UNIQUE (slug, "chunkIndex");


--
-- Name: HelpQueryLog HelpQueryLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."HelpQueryLog"
    ADD CONSTRAINT "HelpQueryLog_pkey" PRIMARY KEY (id);


--
-- Name: IdempotencyKey IdempotencyKey_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."IdempotencyKey"
    ADD CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY (id);


--
-- Name: Invite Invite_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invite"
    ADD CONSTRAINT "Invite_pkey" PRIMARY KEY (id);


--
-- Name: InvoiceLineItem InvoiceLineItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InvoiceLineItem"
    ADD CONSTRAINT "InvoiceLineItem_pkey" PRIMARY KEY (id);


--
-- Name: Invoice Invoice_breedingPlanBuyerId_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_breedingPlanBuyerId_key" UNIQUE ("breedingPlanBuyerId");


--
-- Name: Invoice Invoice_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_pkey" PRIMARY KEY (id);


--
-- Name: LactationCycle LactationCycle_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LactationCycle"
    ADD CONSTRAINT "LactationCycle_pkey" PRIMARY KEY (id);


--
-- Name: LinearAppraisal LinearAppraisal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LinearAppraisal"
    ADD CONSTRAINT "LinearAppraisal_pkey" PRIMARY KEY (id);


--
-- Name: ListingBoost ListingBoost_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ListingBoost"
    ADD CONSTRAINT "ListingBoost_pkey" PRIMARY KEY (id);


--
-- Name: LitterEvent LitterEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LitterEvent"
    ADD CONSTRAINT "LitterEvent_pkey" PRIMARY KEY (id);


--
-- Name: Litter Litter_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Litter"
    ADD CONSTRAINT "Litter_pkey" PRIMARY KEY (id);


--
-- Name: MareReproductiveHistory MareReproductiveHistory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MareReproductiveHistory"
    ADD CONSTRAINT "MareReproductiveHistory_pkey" PRIMARY KEY (id);


--
-- Name: MarketplaceUserBlock MarketplaceUserBlock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MarketplaceUserBlock"
    ADD CONSTRAINT "MarketplaceUserBlock_pkey" PRIMARY KEY (id);


--
-- Name: MarketplaceUserFlag MarketplaceUserFlag_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MarketplaceUserFlag"
    ADD CONSTRAINT "MarketplaceUserFlag_pkey" PRIMARY KEY (id);


--
-- Name: MediaAccessEvent MediaAccessEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MediaAccessEvent"
    ADD CONSTRAINT "MediaAccessEvent_pkey" PRIMARY KEY (id);


--
-- Name: Membership Membership_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Membership"
    ADD CONSTRAINT "Membership_pkey" PRIMARY KEY ("userId", "organizationId");


--
-- Name: MessageParticipant MessageParticipant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MessageParticipant"
    ADD CONSTRAINT "MessageParticipant_pkey" PRIMARY KEY (id);


--
-- Name: MessageThread MessageThread_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MessageThread"
    ADD CONSTRAINT "MessageThread_pkey" PRIMARY KEY (id);


--
-- Name: Message Message_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Message"
    ADD CONSTRAINT "Message_pkey" PRIMARY KEY (id);


--
-- Name: MicrochipRegistry MicrochipRegistry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MicrochipRegistry"
    ADD CONSTRAINT "MicrochipRegistry_pkey" PRIMARY KEY (id);


--
-- Name: MilkingRecord MilkingRecord_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MilkingRecord"
    ADD CONSTRAINT "MilkingRecord_pkey" PRIMARY KEY (id);


--
-- Name: NeonatalCareEntry NeonatalCareEntry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."NeonatalCareEntry"
    ADD CONSTRAINT "NeonatalCareEntry_pkey" PRIMARY KEY (id);


--
-- Name: NeonatalIntervention NeonatalIntervention_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."NeonatalIntervention"
    ADD CONSTRAINT "NeonatalIntervention_pkey" PRIMARY KEY (id);


--
-- Name: NetworkBreedingInquiry NetworkBreedingInquiry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."NetworkBreedingInquiry"
    ADD CONSTRAINT "NetworkBreedingInquiry_pkey" PRIMARY KEY (id);


--
-- Name: NetworkSearchIndex NetworkSearchIndex_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."NetworkSearchIndex"
    ADD CONSTRAINT "NetworkSearchIndex_pkey" PRIMARY KEY (id);


--
-- Name: Notification Notification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_pkey" PRIMARY KEY (id);


--
-- Name: OffspringContract OffspringContract_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OffspringContract"
    ADD CONSTRAINT "OffspringContract_pkey" PRIMARY KEY (id);


--
-- Name: OffspringDocument OffspringDocument_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OffspringDocument"
    ADD CONSTRAINT "OffspringDocument_pkey" PRIMARY KEY (id);


--
-- Name: OffspringEvent OffspringEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OffspringEvent"
    ADD CONSTRAINT "OffspringEvent_pkey" PRIMARY KEY (id);


--
-- Name: OffspringInvoiceLink OffspringInvoiceLink_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OffspringInvoiceLink"
    ADD CONSTRAINT "OffspringInvoiceLink_pkey" PRIMARY KEY (id);


--
-- Name: OffspringProtocolException OffspringProtocolException_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OffspringProtocolException"
    ADD CONSTRAINT "OffspringProtocolException_pkey" PRIMARY KEY (id);


--
-- Name: Offspring Offspring_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Offspring"
    ADD CONSTRAINT "Offspring_pkey" PRIMARY KEY (id);


--
-- Name: Organization Organization_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Organization"
    ADD CONSTRAINT "Organization_pkey" PRIMARY KEY (id);


--
-- Name: PartyActivity PartyActivity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PartyActivity"
    ADD CONSTRAINT "PartyActivity_pkey" PRIMARY KEY (id);


--
-- Name: PartyCommPreferenceEvent PartyCommPreferenceEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PartyCommPreferenceEvent"
    ADD CONSTRAINT "PartyCommPreferenceEvent_pkey" PRIMARY KEY (id);


--
-- Name: PartyCommPreference PartyCommPreference_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PartyCommPreference"
    ADD CONSTRAINT "PartyCommPreference_pkey" PRIMARY KEY (id);


--
-- Name: PartyEmail PartyEmail_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PartyEmail"
    ADD CONSTRAINT "PartyEmail_pkey" PRIMARY KEY (id);


--
-- Name: PartyEvent PartyEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PartyEvent"
    ADD CONSTRAINT "PartyEvent_pkey" PRIMARY KEY (id);


--
-- Name: PartyMilestone PartyMilestone_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PartyMilestone"
    ADD CONSTRAINT "PartyMilestone_pkey" PRIMARY KEY (id);


--
-- Name: PartyNote PartyNote_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PartyNote"
    ADD CONSTRAINT "PartyNote_pkey" PRIMARY KEY (id);


--
-- Name: Party Party_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Party"
    ADD CONSTRAINT "Party_pkey" PRIMARY KEY (id);


--
-- Name: PaymentIntent PaymentIntent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PaymentIntent"
    ADD CONSTRAINT "PaymentIntent_pkey" PRIMARY KEY (id);


--
-- Name: PaymentMethod PaymentMethod_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PaymentMethod"
    ADD CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY (id);


--
-- Name: Payment Payment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_pkey" PRIMARY KEY (id);


--
-- Name: PlanCodeCounter PlanCodeCounter_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PlanCodeCounter"
    ADD CONSTRAINT "PlanCodeCounter_pkey" PRIMARY KEY ("tenantId", year);


--
-- Name: PlanParty PlanParty_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PlanParty"
    ADD CONSTRAINT "PlanParty_pkey" PRIMARY KEY (id);


--
-- Name: PlatformSetting PlatformSetting_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PlatformSetting"
    ADD CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY (id);


--
-- Name: PortalAccess PortalAccess_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PortalAccess"
    ADD CONSTRAINT "PortalAccess_pkey" PRIMARY KEY (id);


--
-- Name: PortalAccess PortalAccess_tenantId_partyId_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PortalAccess"
    ADD CONSTRAINT "PortalAccess_tenantId_partyId_key" UNIQUE ("tenantId", "partyId");


--
-- Name: PortalInvite PortalInvite_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PortalInvite"
    ADD CONSTRAINT "PortalInvite_pkey" PRIMARY KEY (id);


--
-- Name: PregnancyCheck PregnancyCheck_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PregnancyCheck"
    ADD CONSTRAINT "PregnancyCheck_pkey" PRIMARY KEY (id);


--
-- Name: ProductEntitlement ProductEntitlement_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProductEntitlement"
    ADD CONSTRAINT "ProductEntitlement_pkey" PRIMARY KEY (id);


--
-- Name: Product Product_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Product"
    ADD CONSTRAINT "Product_pkey" PRIMARY KEY (id);


--
-- Name: ProtocolComment ProtocolComment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProtocolComment"
    ADD CONSTRAINT "ProtocolComment_pkey" PRIMARY KEY (id);


--
-- Name: ProtocolCopyRecord ProtocolCopyRecord_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProtocolCopyRecord"
    ADD CONSTRAINT "ProtocolCopyRecord_pkey" PRIMARY KEY (id);


--
-- Name: ProtocolRating ProtocolRating_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProtocolRating"
    ADD CONSTRAINT "ProtocolRating_pkey" PRIMARY KEY (id);


--
-- Name: RearingCertificate RearingCertificate_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RearingCertificate"
    ADD CONSTRAINT "RearingCertificate_pkey" PRIMARY KEY (id);


--
-- Name: RearingProtocolActivity RearingProtocolActivity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RearingProtocolActivity"
    ADD CONSTRAINT "RearingProtocolActivity_pkey" PRIMARY KEY (id);


--
-- Name: RearingProtocolAssignment RearingProtocolAssignment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RearingProtocolAssignment"
    ADD CONSTRAINT "RearingProtocolAssignment_pkey" PRIMARY KEY (id);


--
-- Name: RearingProtocolStage RearingProtocolStage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RearingProtocolStage"
    ADD CONSTRAINT "RearingProtocolStage_pkey" PRIMARY KEY (id);


--
-- Name: RearingProtocol RearingProtocol_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RearingProtocol"
    ADD CONSTRAINT "RearingProtocol_pkey" PRIMARY KEY (id);


--
-- Name: RegistryConnection RegistryConnection_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RegistryConnection"
    ADD CONSTRAINT "RegistryConnection_pkey" PRIMARY KEY (id);


--
-- Name: RegistryPedigree RegistryPedigree_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RegistryPedigree"
    ADD CONSTRAINT "RegistryPedigree_pkey" PRIMARY KEY (id);


--
-- Name: RegistrySyncLog RegistrySyncLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RegistrySyncLog"
    ADD CONSTRAINT "RegistrySyncLog_pkey" PRIMARY KEY (id);


--
-- Name: RegistryVerification RegistryVerification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RegistryVerification"
    ADD CONSTRAINT "RegistryVerification_pkey" PRIMARY KEY (id);


--
-- Name: Registry Registry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Registry"
    ADD CONSTRAINT "Registry_pkey" PRIMARY KEY (id);


--
-- Name: ReproductiveCycle ReproductiveCycle_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ReproductiveCycle"
    ADD CONSTRAINT "ReproductiveCycle_pkey" PRIMARY KEY (id);


--
-- Name: SchedulingAvailabilityBlock SchedulingAvailabilityBlock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SchedulingAvailabilityBlock"
    ADD CONSTRAINT "SchedulingAvailabilityBlock_pkey" PRIMARY KEY (id);


--
-- Name: SchedulingBooking SchedulingBooking_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SchedulingBooking"
    ADD CONSTRAINT "SchedulingBooking_pkey" PRIMARY KEY (id);


--
-- Name: SchedulingEventTemplate SchedulingEventTemplate_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SchedulingEventTemplate"
    ADD CONSTRAINT "SchedulingEventTemplate_pkey" PRIMARY KEY (id);


--
-- Name: SchedulingSlot SchedulingSlot_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SchedulingSlot"
    ADD CONSTRAINT "SchedulingSlot_pkey" PRIMARY KEY (id);


--
-- Name: SemenInventory SemenInventory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SemenInventory"
    ADD CONSTRAINT "SemenInventory_pkey" PRIMARY KEY (id);


--
-- Name: SemenUsage SemenUsage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SemenUsage"
    ADD CONSTRAINT "SemenUsage_pkey" PRIMARY KEY (id);


--
-- Name: Sequence Sequence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Sequence"
    ADD CONSTRAINT "Sequence_pkey" PRIMARY KEY (id);


--
-- Name: Session Session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_pkey" PRIMARY KEY (id);


--
-- Name: ShareCode ShareCode_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ShareCode"
    ADD CONSTRAINT "ShareCode_pkey" PRIMARY KEY (id);


--
-- Name: ShearingRecord ShearingRecord_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ShearingRecord"
    ADD CONSTRAINT "ShearingRecord_pkey" PRIMARY KEY (id);


--
-- Name: SignatureEvent SignatureEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SignatureEvent"
    ADD CONSTRAINT "SignatureEvent_pkey" PRIMARY KEY (id);


--
-- Name: StudVisibilityRule StudVisibilityRule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StudVisibilityRule"
    ADD CONSTRAINT "StudVisibilityRule_pkey" PRIMARY KEY (id);


--
-- Name: SubscriptionAddOn SubscriptionAddOn_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SubscriptionAddOn"
    ADD CONSTRAINT "SubscriptionAddOn_pkey" PRIMARY KEY (id);


--
-- Name: Subscription Subscription_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Subscription"
    ADD CONSTRAINT "Subscription_pkey" PRIMARY KEY (id);


--
-- Name: SupplementAdministration SupplementAdministration_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SupplementAdministration"
    ADD CONSTRAINT "SupplementAdministration_pkey" PRIMARY KEY (id);


--
-- Name: SupplementProtocol SupplementProtocol_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SupplementProtocol"
    ADD CONSTRAINT "SupplementProtocol_pkey" PRIMARY KEY (id);


--
-- Name: SupplementSchedule SupplementSchedule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SupplementSchedule"
    ADD CONSTRAINT "SupplementSchedule_pkey" PRIMARY KEY (id);


--
-- Name: TagAssignment TagAssignment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TagAssignment"
    ADD CONSTRAINT "TagAssignment_pkey" PRIMARY KEY (id);


--
-- Name: Tag Tag_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Tag"
    ADD CONSTRAINT "Tag_pkey" PRIMARY KEY (id);


--
-- Name: Task Task_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_pkey" PRIMARY KEY (id);


--
-- Name: TemplateContent TemplateContent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TemplateContent"
    ADD CONSTRAINT "TemplateContent_pkey" PRIMARY KEY (id);


--
-- Name: Template Template_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Template"
    ADD CONSTRAINT "Template_pkey" PRIMARY KEY (id);


--
-- Name: TenantMembership TenantMembership_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TenantMembership"
    ADD CONSTRAINT "TenantMembership_pkey" PRIMARY KEY ("userId", "tenantId");


--
-- Name: TenantProgramBreed TenantProgramBreed_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TenantProgramBreed"
    ADD CONSTRAINT "TenantProgramBreed_pkey" PRIMARY KEY (id);


--
-- Name: TenantSetting TenantSetting_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TenantSetting"
    ADD CONSTRAINT "TenantSetting_pkey" PRIMARY KEY ("tenantId", namespace);


--
-- Name: Tenant Tenant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Tenant"
    ADD CONSTRAINT "Tenant_pkey" PRIMARY KEY (id);


--
-- Name: TestResult TestResult_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TestResult"
    ADD CONSTRAINT "TestResult_pkey" PRIMARY KEY (id);


--
-- Name: TitleDefinition TitleDefinition_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TitleDefinition"
    ADD CONSTRAINT "TitleDefinition_pkey" PRIMARY KEY (id);


--
-- Name: TosAcceptance TosAcceptance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TosAcceptance"
    ADD CONSTRAINT "TosAcceptance_pkey" PRIMARY KEY (id);


--
-- Name: TraitDefinition TraitDefinition_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TraitDefinition"
    ADD CONSTRAINT "TraitDefinition_pkey" PRIMARY KEY (id);


--
-- Name: UnlinkedEmail UnlinkedEmail_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UnlinkedEmail"
    ADD CONSTRAINT "UnlinkedEmail_pkey" PRIMARY KEY (id);


--
-- Name: UsageRecord UsageRecord_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UsageRecord"
    ADD CONSTRAINT "UsageRecord_pkey" PRIMARY KEY (id);


--
-- Name: UsageSnapshot UsageSnapshot_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UsageSnapshot"
    ADD CONSTRAINT "UsageSnapshot_pkey" PRIMARY KEY ("tenantId", "metricKey");


--
-- Name: UserEntitlement UserEntitlement_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserEntitlement"
    ADD CONSTRAINT "UserEntitlement_pkey" PRIMARY KEY (id);


--
-- Name: UserHelpPreference UserHelpPreference_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserHelpPreference"
    ADD CONSTRAINT "UserHelpPreference_pkey" PRIMARY KEY (id);


--
-- Name: UserHelpPreference UserHelpPreference_userId_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserHelpPreference"
    ADD CONSTRAINT "UserHelpPreference_userId_key" UNIQUE ("userId");


--
-- Name: UserNotificationPreferences UserNotificationPreferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserNotificationPreferences"
    ADD CONSTRAINT "UserNotificationPreferences_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: VaccinationRecord VaccinationRecord_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VaccinationRecord"
    ADD CONSTRAINT "VaccinationRecord_pkey" PRIMARY KEY (id);


--
-- Name: VerificationToken VerificationToken_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VerificationToken"
    ADD CONSTRAINT "VerificationToken_pkey" PRIMARY KEY (identifier, "tokenHash");


--
-- Name: WaitlistEntry WaitlistEntry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WaitlistEntry"
    ADD CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY (id);


--
-- Name: WatermarkedAsset WatermarkedAsset_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WatermarkedAsset"
    ADD CONSTRAINT "WatermarkedAsset_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: animal_loci animal_loci_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.animal_loci
    ADD CONSTRAINT animal_loci_pkey PRIMARY KEY (id);


--
-- Name: devices devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_pkey PRIMARY KEY (id);


--
-- Name: entity_activity entity_activity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_activity
    ADD CONSTRAINT entity_activity_pkey PRIMARY KEY (id);


--
-- Name: entity_audit_log entity_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_audit_log
    ADD CONSTRAINT entity_audit_log_pkey PRIMARY KEY (id);


--
-- Name: mkt_breeding_booking_animal mkt_breeding_booking_animal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mkt_breeding_booking_animal
    ADD CONSTRAINT mkt_breeding_booking_animal_pkey PRIMARY KEY (id);


--
-- Name: mkt_listing_animal_program mkt_listing_animal_program_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mkt_listing_animal_program
    ADD CONSTRAINT mkt_listing_animal_program_pkey PRIMARY KEY (id);


--
-- Name: mkt_listing_breeding_booking mkt_listing_breeding_booking_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mkt_listing_breeding_booking
    ADD CONSTRAINT mkt_listing_breeding_booking_pkey PRIMARY KEY (id);


--
-- Name: mkt_listing_breeding_program mkt_listing_breeding_program_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mkt_listing_breeding_program
    ADD CONSTRAINT mkt_listing_breeding_program_pkey PRIMARY KEY (id);


--
-- Name: mkt_listing_individual_animal mkt_listing_individual_animal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mkt_listing_individual_animal
    ADD CONSTRAINT mkt_listing_individual_animal_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: idx_table_stats_captured; Type: INDEX; Schema: _monitoring; Owner: -
--

CREATE INDEX idx_table_stats_captured ON _monitoring.table_stats USING btree (captured_at DESC);


--
-- Name: idx_table_stats_table_time; Type: INDEX; Schema: _monitoring; Owner: -
--

CREATE INDEX idx_table_stats_table_time ON _monitoring.table_stats USING btree (schema_name, table_name, captured_at DESC);


--
-- Name: abuse_reports_created_at_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX abuse_reports_created_at_idx ON marketplace.abuse_reports USING btree (created_at);


--
-- Name: abuse_reports_listing_id_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX abuse_reports_listing_id_idx ON marketplace.abuse_reports USING btree (listing_id);


--
-- Name: abuse_reports_status_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX abuse_reports_status_idx ON marketplace.abuse_reports USING btree (status);


--
-- Name: idx_intl_waitlist_country; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX idx_intl_waitlist_country ON marketplace.international_waitlist USING btree (country);


--
-- Name: idx_intl_waitlist_email_country; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE UNIQUE INDEX idx_intl_waitlist_email_country ON marketplace.international_waitlist USING btree (email, country);


--
-- Name: idx_intl_waitlist_notified_at; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX idx_intl_waitlist_notified_at ON marketplace.international_waitlist USING btree (notified_at);


--
-- Name: invoices_client_id_status_created_at_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX invoices_client_id_status_created_at_idx ON marketplace.invoices USING btree (client_id, status, created_at DESC);


--
-- Name: invoices_invoice_number_key; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE UNIQUE INDEX invoices_invoice_number_key ON marketplace.invoices USING btree (invoice_number);


--
-- Name: invoices_provider_id_status_created_at_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX invoices_provider_id_status_created_at_idx ON marketplace.invoices USING btree (provider_id, status, created_at DESC);


--
-- Name: invoices_status_due_at_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX invoices_status_due_at_idx ON marketplace.invoices USING btree (status, due_at);


--
-- Name: invoices_stripe_charge_id_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX invoices_stripe_charge_id_idx ON marketplace.invoices USING btree (stripe_charge_id);


--
-- Name: invoices_stripe_invoice_id_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX invoices_stripe_invoice_id_idx ON marketplace.invoices USING btree (stripe_invoice_id);


--
-- Name: invoices_stripe_invoice_id_key; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE UNIQUE INDEX invoices_stripe_invoice_id_key ON marketplace.invoices USING btree (stripe_invoice_id);


--
-- Name: invoices_stripe_payment_intent_id_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX invoices_stripe_payment_intent_id_idx ON marketplace.invoices USING btree (stripe_payment_intent_id);


--
-- Name: invoices_stripe_payment_intent_id_key; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE UNIQUE INDEX invoices_stripe_payment_intent_id_key ON marketplace.invoices USING btree (stripe_payment_intent_id);


--
-- Name: invoices_transaction_id_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX invoices_transaction_id_idx ON marketplace.invoices USING btree (transaction_id);


--
-- Name: invoices_transaction_id_key; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE UNIQUE INDEX invoices_transaction_id_key ON marketplace.invoices USING btree (transaction_id);


--
-- Name: message_threads_client_id_last_message_at_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX message_threads_client_id_last_message_at_idx ON marketplace.message_threads USING btree (client_id, last_message_at DESC);


--
-- Name: message_threads_provider_id_last_message_at_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX message_threads_provider_id_last_message_at_idx ON marketplace.message_threads USING btree (provider_id, last_message_at DESC);


--
-- Name: messages_thread_id_created_at_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX messages_thread_id_created_at_idx ON marketplace.messages USING btree (thread_id, created_at DESC);


--
-- Name: mkt_listing_breeder_service_category_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX mkt_listing_breeder_service_category_idx ON marketplace.mkt_listing_breeder_service USING btree (category);


--
-- Name: mkt_listing_breeder_service_city_state_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX mkt_listing_breeder_service_city_state_idx ON marketplace.mkt_listing_breeder_service USING btree (city, state);


--
-- Name: mkt_listing_breeder_service_deleted_at_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX mkt_listing_breeder_service_deleted_at_idx ON marketplace.mkt_listing_breeder_service USING btree (deleted_at);


--
-- Name: mkt_listing_breeder_service_expires_at_status_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX mkt_listing_breeder_service_expires_at_status_idx ON marketplace.mkt_listing_breeder_service USING btree (expires_at, status);


--
-- Name: mkt_listing_breeder_service_is_featured_featured_until_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX mkt_listing_breeder_service_is_featured_featured_until_idx ON marketplace.mkt_listing_breeder_service USING btree (is_featured, featured_until);


--
-- Name: mkt_listing_breeder_service_provider_id_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX mkt_listing_breeder_service_provider_id_idx ON marketplace.mkt_listing_breeder_service USING btree (provider_id);


--
-- Name: mkt_listing_breeder_service_slug_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX mkt_listing_breeder_service_slug_idx ON marketplace.mkt_listing_breeder_service USING btree (slug);


--
-- Name: mkt_listing_breeder_service_source_type_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX mkt_listing_breeder_service_source_type_idx ON marketplace.mkt_listing_breeder_service USING btree (source_type);


--
-- Name: mkt_listing_breeder_service_status_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX mkt_listing_breeder_service_status_idx ON marketplace.mkt_listing_breeder_service USING btree (status);


--
-- Name: mkt_listing_breeder_service_stripe_subscription_id_key; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE UNIQUE INDEX mkt_listing_breeder_service_stripe_subscription_id_key ON marketplace.mkt_listing_breeder_service USING btree (stripe_subscription_id);


--
-- Name: mkt_listing_breeder_service_tenant_id_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX mkt_listing_breeder_service_tenant_id_idx ON marketplace.mkt_listing_breeder_service USING btree (tenant_id);


--
-- Name: mobile_refresh_tokens_token_hash_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX mobile_refresh_tokens_token_hash_idx ON marketplace.mobile_refresh_tokens USING btree (token_hash);


--
-- Name: mobile_refresh_tokens_token_hash_key; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE UNIQUE INDEX mobile_refresh_tokens_token_hash_key ON marketplace.mobile_refresh_tokens USING btree (token_hash);


--
-- Name: mobile_refresh_tokens_user_id_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX mobile_refresh_tokens_user_id_idx ON marketplace.mobile_refresh_tokens USING btree (user_id);


--
-- Name: provider_reports_provider_id_status_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX provider_reports_provider_id_status_idx ON marketplace.provider_reports USING btree (provider_id, status);


--
-- Name: provider_reports_reporter_user_id_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX provider_reports_reporter_user_id_idx ON marketplace.provider_reports USING btree (reporter_user_id);


--
-- Name: provider_reports_status_created_at_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX provider_reports_status_created_at_idx ON marketplace.provider_reports USING btree (status, created_at);


--
-- Name: provider_terms_acceptance_accepted_at_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX provider_terms_acceptance_accepted_at_idx ON marketplace.provider_terms_acceptance USING btree (accepted_at);


--
-- Name: provider_terms_acceptance_user_id_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX provider_terms_acceptance_user_id_idx ON marketplace.provider_terms_acceptance USING btree (user_id);


--
-- Name: provider_terms_acceptance_user_id_version_key; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE UNIQUE INDEX provider_terms_acceptance_user_id_version_key ON marketplace.provider_terms_acceptance USING btree (user_id, version);


--
-- Name: provider_terms_acceptance_version_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX provider_terms_acceptance_version_idx ON marketplace.provider_terms_acceptance USING btree (version);


--
-- Name: providers_city_state_status_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX providers_city_state_status_idx ON marketplace.providers USING btree (city, state, status);


--
-- Name: providers_deleted_at_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX providers_deleted_at_idx ON marketplace.providers USING btree (deleted_at);


--
-- Name: providers_flagged_at_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX providers_flagged_at_idx ON marketplace.providers USING btree (flagged_at);


--
-- Name: providers_status_activated_at_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX providers_status_activated_at_idx ON marketplace.providers USING btree (status, activated_at);


--
-- Name: providers_stripe_connect_account_id_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX providers_stripe_connect_account_id_idx ON marketplace.providers USING btree (stripe_connect_account_id);


--
-- Name: providers_stripe_connect_account_id_key; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE UNIQUE INDEX providers_stripe_connect_account_id_key ON marketplace.providers USING btree (stripe_connect_account_id);


--
-- Name: providers_tenant_id_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX providers_tenant_id_idx ON marketplace.providers USING btree (tenant_id);


--
-- Name: providers_user_id_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX providers_user_id_idx ON marketplace.providers USING btree (user_id);


--
-- Name: providers_user_id_key; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE UNIQUE INDEX providers_user_id_key ON marketplace.providers USING btree (user_id);


--
-- Name: providers_verification_tier_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX providers_verification_tier_idx ON marketplace.providers USING btree (verification_tier);


--
-- Name: reviews_client_id_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX reviews_client_id_idx ON marketplace.reviews USING btree (client_id);


--
-- Name: reviews_listing_id_status_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX reviews_listing_id_status_idx ON marketplace.reviews USING btree (listing_id, status);


--
-- Name: reviews_provider_id_status_created_at_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX reviews_provider_id_status_created_at_idx ON marketplace.reviews USING btree (provider_id, status, created_at DESC);


--
-- Name: reviews_rating_status_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX reviews_rating_status_idx ON marketplace.reviews USING btree (rating, status);


--
-- Name: reviews_transaction_id_key; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE UNIQUE INDEX reviews_transaction_id_key ON marketplace.reviews USING btree (transaction_id);


--
-- Name: saved_listings_bhq_user_id_listing_type_listing_id_key; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE UNIQUE INDEX saved_listings_bhq_user_id_listing_type_listing_id_key ON marketplace.saved_listings USING btree (bhq_user_id, listing_type, listing_id);


--
-- Name: saved_listings_bhq_user_id_saved_at_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX saved_listings_bhq_user_id_saved_at_idx ON marketplace.saved_listings USING btree (bhq_user_id, saved_at DESC);


--
-- Name: saved_listings_listing_type_listing_id_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX saved_listings_listing_type_listing_id_idx ON marketplace.saved_listings USING btree (listing_type, listing_id);


--
-- Name: service_tag_assignments_listing_id_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX service_tag_assignments_listing_id_idx ON marketplace.service_tag_assignments USING btree (listing_id);


--
-- Name: service_tag_assignments_tag_id_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX service_tag_assignments_tag_id_idx ON marketplace.service_tag_assignments USING btree (tag_id);


--
-- Name: service_tags_name_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX service_tags_name_idx ON marketplace.service_tags USING btree (name);


--
-- Name: service_tags_slug_key; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE UNIQUE INDEX service_tags_slug_key ON marketplace.service_tags USING btree (slug);


--
-- Name: service_tags_suggested_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX service_tags_suggested_idx ON marketplace.service_tags USING btree (suggested);


--
-- Name: service_tags_usage_count_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX service_tags_usage_count_idx ON marketplace.service_tags USING btree (usage_count DESC);


--
-- Name: stripe_identity_sessions_created_at_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX stripe_identity_sessions_created_at_idx ON marketplace.stripe_identity_sessions USING btree (created_at DESC);


--
-- Name: stripe_identity_sessions_status_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX stripe_identity_sessions_status_idx ON marketplace.stripe_identity_sessions USING btree (status);


--
-- Name: stripe_identity_sessions_stripe_session_id_key; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE UNIQUE INDEX stripe_identity_sessions_stripe_session_id_key ON marketplace.stripe_identity_sessions USING btree (stripe_session_id);


--
-- Name: stripe_identity_sessions_user_id_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX stripe_identity_sessions_user_id_idx ON marketplace.stripe_identity_sessions USING btree (user_id);


--
-- Name: transactions_client_id_status_created_at_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX transactions_client_id_status_created_at_idx ON marketplace.transactions USING btree (client_id, status, created_at DESC);


--
-- Name: transactions_invoice_type_tenant_id_invoice_id_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX transactions_invoice_type_tenant_id_invoice_id_idx ON marketplace.transactions USING btree (invoice_type, tenant_id, invoice_id);


--
-- Name: transactions_listing_id_status_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX transactions_listing_id_status_idx ON marketplace.transactions USING btree (listing_id, status);


--
-- Name: transactions_provider_id_status_created_at_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX transactions_provider_id_status_created_at_idx ON marketplace.transactions USING btree (provider_id, status, created_at DESC);


--
-- Name: transactions_status_paid_at_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX transactions_status_paid_at_idx ON marketplace.transactions USING btree (status, paid_at);


--
-- Name: users_deleted_at_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX users_deleted_at_idx ON marketplace.users USING btree (deleted_at);


--
-- Name: users_email_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX users_email_idx ON marketplace.users USING btree (email);


--
-- Name: users_email_key; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE UNIQUE INDEX users_email_key ON marketplace.users USING btree (email);


--
-- Name: users_email_verify_token_key; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE UNIQUE INDEX users_email_verify_token_key ON marketplace.users USING btree (email_verify_token);


--
-- Name: users_password_reset_token_key; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE UNIQUE INDEX users_password_reset_token_key ON marketplace.users USING btree (password_reset_token);


--
-- Name: users_service_provider_tier_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX users_service_provider_tier_idx ON marketplace.users USING btree (service_provider_tier);


--
-- Name: users_status_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX users_status_idx ON marketplace.users USING btree (status);


--
-- Name: users_stripe_customer_id_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX users_stripe_customer_id_idx ON marketplace.users USING btree (stripe_customer_id);


--
-- Name: users_stripe_customer_id_key; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE UNIQUE INDEX users_stripe_customer_id_key ON marketplace.users USING btree (stripe_customer_id);


--
-- Name: users_tenant_id_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX users_tenant_id_idx ON marketplace.users USING btree (tenant_id);


--
-- Name: users_two_factor_enabled_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX users_two_factor_enabled_idx ON marketplace.users USING btree (two_factor_enabled);


--
-- Name: verification_requests_marketplace_user_id_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX verification_requests_marketplace_user_id_idx ON marketplace.verification_requests USING btree (marketplace_user_id);


--
-- Name: verification_requests_provider_id_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX verification_requests_provider_id_idx ON marketplace.verification_requests USING btree (provider_id);


--
-- Name: verification_requests_reviewed_by_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX verification_requests_reviewed_by_idx ON marketplace.verification_requests USING btree (reviewed_by);


--
-- Name: verification_requests_status_created_at_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX verification_requests_status_created_at_idx ON marketplace.verification_requests USING btree (status, created_at DESC);


--
-- Name: verification_requests_user_type_status_idx; Type: INDEX; Schema: marketplace; Owner: -
--

CREATE INDEX verification_requests_user_type_status_idx ON marketplace.verification_requests USING btree (user_type, status);


--
-- Name: ActivityCompletion_assignmentId_activityId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ActivityCompletion_assignmentId_activityId_idx" ON public."ActivityCompletion" USING btree ("assignmentId", "activityId");


--
-- Name: ActivityCompletion_assignmentId_activityId_offspringId_chec_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ActivityCompletion_assignmentId_activityId_offspringId_chec_key" ON public."ActivityCompletion" USING btree ("assignmentId", "activityId", "offspringId", "checklistItemKey");


--
-- Name: ActivityCompletion_offspringId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ActivityCompletion_offspringId_idx" ON public."ActivityCompletion" USING btree ("offspringId");


--
-- Name: ActivityCompletion_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ActivityCompletion_tenantId_idx" ON public."ActivityCompletion" USING btree ("tenantId");


--
-- Name: AnimalAccessConversation_animalAccessId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnimalAccessConversation_animalAccessId_idx" ON public."AnimalAccessConversation" USING btree ("animalAccessId");


--
-- Name: AnimalAccessConversation_animalAccessId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AnimalAccessConversation_animalAccessId_key" ON public."AnimalAccessConversation" USING btree ("animalAccessId");


--
-- Name: AnimalAccessConversation_messageThreadId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnimalAccessConversation_messageThreadId_idx" ON public."AnimalAccessConversation" USING btree ("messageThreadId");


--
-- Name: AnimalAccessConversation_messageThreadId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AnimalAccessConversation_messageThreadId_key" ON public."AnimalAccessConversation" USING btree ("messageThreadId");


--
-- Name: AnimalAccess_accessorTenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnimalAccess_accessorTenantId_status_idx" ON public."AnimalAccess" USING btree ("accessorTenantId", status);


--
-- Name: AnimalAccess_animalId_accessorTenantId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AnimalAccess_animalId_accessorTenantId_key" ON public."AnimalAccess" USING btree ("animalId", "accessorTenantId");


--
-- Name: AnimalAccess_animalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnimalAccess_animalId_idx" ON public."AnimalAccess" USING btree ("animalId");


--
-- Name: AnimalAccess_expiresAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnimalAccess_expiresAt_idx" ON public."AnimalAccess" USING btree ("expiresAt");


--
-- Name: AnimalAccess_ownerTenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnimalAccess_ownerTenantId_status_idx" ON public."AnimalAccess" USING btree ("ownerTenantId", status);


--
-- Name: AnimalAccess_shareCodeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnimalAccess_shareCodeId_idx" ON public."AnimalAccess" USING btree ("shareCodeId");


--
-- Name: AnimalAccess_status_deletedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnimalAccess_status_deletedAt_idx" ON public."AnimalAccess" USING btree (status, "deletedAt");


--
-- Name: AnimalBreed_animalId_breedId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AnimalBreed_animalId_breedId_key" ON public."AnimalBreed" USING btree ("animalId", "breedId");


--
-- Name: AnimalBreed_animalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnimalBreed_animalId_idx" ON public."AnimalBreed" USING btree ("animalId");


--
-- Name: AnimalBreed_breedId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnimalBreed_breedId_idx" ON public."AnimalBreed" USING btree ("breedId");


--
-- Name: AnimalBreedingProfile_animalId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AnimalBreedingProfile_animalId_key" ON public."AnimalBreedingProfile" USING btree ("animalId");


--
-- Name: AnimalBreedingProfile_tenantId_animalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnimalBreedingProfile_tenantId_animalId_idx" ON public."AnimalBreedingProfile" USING btree ("tenantId", "animalId");


--
-- Name: AnimalBreedingProfile_tenantId_breedingStatus_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnimalBreedingProfile_tenantId_breedingStatus_idx" ON public."AnimalBreedingProfile" USING btree ("tenantId", "breedingStatus");


--
-- Name: AnimalGenetics_animalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnimalGenetics_animalId_idx" ON public."AnimalGenetics" USING btree ("animalId");


--
-- Name: AnimalGenetics_animalId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AnimalGenetics_animalId_key" ON public."AnimalGenetics" USING btree ("animalId");


--
-- Name: AnimalIdentityLink_animalId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AnimalIdentityLink_animalId_key" ON public."AnimalIdentityLink" USING btree ("animalId");


--
-- Name: AnimalIdentityLink_identityId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnimalIdentityLink_identityId_idx" ON public."AnimalIdentityLink" USING btree ("identityId");


--
-- Name: AnimalIncompatibility_profileId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnimalIncompatibility_profileId_idx" ON public."AnimalIncompatibility" USING btree ("profileId");


--
-- Name: AnimalIncompatibility_profileId_incompatibleAnimalId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AnimalIncompatibility_profileId_incompatibleAnimalId_key" ON public."AnimalIncompatibility" USING btree ("profileId", "incompatibleAnimalId");


--
-- Name: AnimalIncompatibility_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnimalIncompatibility_tenantId_idx" ON public."AnimalIncompatibility" USING btree ("tenantId");


--
-- Name: AnimalLinkRequest_requestingTenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnimalLinkRequest_requestingTenantId_idx" ON public."AnimalLinkRequest" USING btree ("requestingTenantId");


--
-- Name: AnimalLinkRequest_sourceAnimalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnimalLinkRequest_sourceAnimalId_idx" ON public."AnimalLinkRequest" USING btree ("sourceAnimalId");


--
-- Name: AnimalLinkRequest_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnimalLinkRequest_status_idx" ON public."AnimalLinkRequest" USING btree (status);


--
-- Name: AnimalLinkRequest_targetAnimalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnimalLinkRequest_targetAnimalId_idx" ON public."AnimalLinkRequest" USING btree ("targetAnimalId");


--
-- Name: AnimalLinkRequest_targetTenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnimalLinkRequest_targetTenantId_idx" ON public."AnimalLinkRequest" USING btree ("targetTenantId");


--
-- Name: AnimalMicrochipRegistration_registeredToContactId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnimalMicrochipRegistration_registeredToContactId_idx" ON public."AnimalMicrochipRegistration" USING btree ("registeredToContactId");


--
-- Name: AnimalMicrochipRegistration_tenantId_animalId_registryId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AnimalMicrochipRegistration_tenantId_animalId_registryId_key" ON public."AnimalMicrochipRegistration" USING btree ("tenantId", "animalId", "registryId");


--
-- Name: AnimalMicrochipRegistration_tenantId_expirationDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnimalMicrochipRegistration_tenantId_expirationDate_idx" ON public."AnimalMicrochipRegistration" USING btree ("tenantId", "expirationDate");


--
-- Name: AnimalMicrochipRegistration_tenantId_offspringId_registryId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AnimalMicrochipRegistration_tenantId_offspringId_registryId_key" ON public."AnimalMicrochipRegistration" USING btree ("tenantId", "offspringId", "registryId");


--
-- Name: AnimalOwner_animalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnimalOwner_animalId_idx" ON public."AnimalOwner" USING btree ("animalId");


--
-- Name: AnimalOwner_animalId_partyId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AnimalOwner_animalId_partyId_key" ON public."AnimalOwner" USING btree ("animalId", "partyId");


--
-- Name: AnimalOwner_partyId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnimalOwner_partyId_idx" ON public."AnimalOwner" USING btree ("partyId");


--
-- Name: AnimalOwnershipChange_animalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnimalOwnershipChange_animalId_idx" ON public."AnimalOwnershipChange" USING btree ("animalId");


--
-- Name: AnimalOwnershipChange_kind_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnimalOwnershipChange_kind_idx" ON public."AnimalOwnershipChange" USING btree (kind);


--
-- Name: AnimalOwnershipChange_occurredAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnimalOwnershipChange_occurredAt_idx" ON public."AnimalOwnershipChange" USING btree ("occurredAt");


--
-- Name: AnimalOwnershipChange_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnimalOwnershipChange_tenantId_idx" ON public."AnimalOwnershipChange" USING btree ("tenantId");


--
-- Name: AnimalPrivacySettings_animalId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AnimalPrivacySettings_animalId_key" ON public."AnimalPrivacySettings" USING btree ("animalId");


--
-- Name: AnimalProgramMedia_programId_sortOrder_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnimalProgramMedia_programId_sortOrder_idx" ON public."AnimalProgramMedia" USING btree ("programId", "sortOrder");


--
-- Name: AnimalProgramParticipant_animalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnimalProgramParticipant_animalId_idx" ON public."AnimalProgramParticipant" USING btree ("animalId");


--
-- Name: AnimalProgramParticipant_programId_animalId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AnimalProgramParticipant_programId_animalId_key" ON public."AnimalProgramParticipant" USING btree ("programId", "animalId");


--
-- Name: AnimalProgramParticipant_programId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnimalProgramParticipant_programId_status_idx" ON public."AnimalProgramParticipant" USING btree ("programId", status);


--
-- Name: AnimalRegistryIdentifier_animalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnimalRegistryIdentifier_animalId_idx" ON public."AnimalRegistryIdentifier" USING btree ("animalId");


--
-- Name: AnimalRegistryIdentifier_registryId_identifier_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AnimalRegistryIdentifier_registryId_identifier_key" ON public."AnimalRegistryIdentifier" USING btree ("registryId", identifier);


--
-- Name: AnimalRegistryIdentifier_registryId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnimalRegistryIdentifier_registryId_idx" ON public."AnimalRegistryIdentifier" USING btree ("registryId");


--
-- Name: AnimalTitleDocument_animalTitleId_documentId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AnimalTitleDocument_animalTitleId_documentId_key" ON public."AnimalTitleDocument" USING btree ("animalTitleId", "documentId");


--
-- Name: AnimalTitle_animalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnimalTitle_animalId_idx" ON public."AnimalTitle" USING btree ("animalId");


--
-- Name: AnimalTitle_animalId_titleDefinitionId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AnimalTitle_animalId_titleDefinitionId_key" ON public."AnimalTitle" USING btree ("animalId", "titleDefinitionId");


--
-- Name: AnimalTitle_isPublic_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnimalTitle_isPublic_idx" ON public."AnimalTitle" USING btree ("isPublic");


--
-- Name: AnimalTitle_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnimalTitle_status_idx" ON public."AnimalTitle" USING btree (status);


--
-- Name: AnimalTitle_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnimalTitle_tenantId_idx" ON public."AnimalTitle" USING btree ("tenantId");


--
-- Name: AnimalTraitEntry_tenantId_animalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnimalTraitEntry_tenantId_animalId_idx" ON public."AnimalTraitEntry" USING btree ("tenantId", "animalId");


--
-- Name: AnimalTraitEntry_tenantId_animalId_recordedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnimalTraitEntry_tenantId_animalId_recordedAt_idx" ON public."AnimalTraitEntry" USING btree ("tenantId", "animalId", "recordedAt");


--
-- Name: AnimalTraitEntry_tenantId_animalId_traitDefinitionId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnimalTraitEntry_tenantId_animalId_traitDefinitionId_idx" ON public."AnimalTraitEntry" USING btree ("tenantId", "animalId", "traitDefinitionId");


--
-- Name: AnimalTraitValueDocument_tenantId_animalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnimalTraitValueDocument_tenantId_animalId_idx" ON public."AnimalTraitValueDocument" USING btree ("tenantId", "animalId");


--
-- Name: AnimalTraitValueDocument_tenantId_animalTraitValueId_docume_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AnimalTraitValueDocument_tenantId_animalTraitValueId_docume_key" ON public."AnimalTraitValueDocument" USING btree ("tenantId", "animalTraitValueId", "documentId");


--
-- Name: AnimalTraitValueDocument_tenantId_animalTraitValueId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnimalTraitValueDocument_tenantId_animalTraitValueId_idx" ON public."AnimalTraitValueDocument" USING btree ("tenantId", "animalTraitValueId");


--
-- Name: AnimalTraitValueDocument_tenantId_documentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnimalTraitValueDocument_tenantId_documentId_idx" ON public."AnimalTraitValueDocument" USING btree ("tenantId", "documentId");


--
-- Name: AnimalTraitValue_tenantId_animalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnimalTraitValue_tenantId_animalId_idx" ON public."AnimalTraitValue" USING btree ("tenantId", "animalId");


--
-- Name: AnimalTraitValue_tenantId_animalId_traitDefinitionId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AnimalTraitValue_tenantId_animalId_traitDefinitionId_key" ON public."AnimalTraitValue" USING btree ("tenantId", "animalId", "traitDefinitionId");


--
-- Name: AnimalTraitValue_tenantId_traitDefinitionId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnimalTraitValue_tenantId_traitDefinitionId_idx" ON public."AnimalTraitValue" USING btree ("tenantId", "traitDefinitionId");


--
-- Name: Animal_archived_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Animal_archived_idx" ON public."Animal" USING btree (archived);


--
-- Name: Animal_breedingPlanId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Animal_breedingPlanId_idx" ON public."Animal" USING btree ("breedingPlanId");


--
-- Name: Animal_buyerPartyId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Animal_buyerPartyId_idx" ON public."Animal" USING btree ("buyerPartyId");


--
-- Name: Animal_canonicalBreedId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Animal_canonicalBreedId_idx" ON public."Animal" USING btree ("canonicalBreedId");


--
-- Name: Animal_damId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Animal_damId_idx" ON public."Animal" USING btree ("damId");


--
-- Name: Animal_exchangeCode_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Animal_exchangeCode_key" ON public."Animal" USING btree ("exchangeCode");


--
-- Name: Animal_litterId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Animal_litterId_idx" ON public."Animal" USING btree ("litterId");


--
-- Name: Animal_organizationId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Animal_organizationId_idx" ON public."Animal" USING btree ("organizationId");


--
-- Name: Animal_sireId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Animal_sireId_idx" ON public."Animal" USING btree ("sireId");


--
-- Name: Animal_species_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Animal_species_idx" ON public."Animal" USING btree (species);


--
-- Name: Animal_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Animal_status_idx" ON public."Animal" USING btree (status);


--
-- Name: Animal_tenantId_buyerPartyId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Animal_tenantId_buyerPartyId_idx" ON public."Animal" USING btree ("tenantId", "buyerPartyId");


--
-- Name: Animal_tenantId_customBreedId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Animal_tenantId_customBreedId_idx" ON public."Animal" USING btree ("tenantId", "customBreedId");


--
-- Name: Animal_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Animal_tenantId_idx" ON public."Animal" USING btree ("tenantId");


--
-- Name: Animal_tenantId_microchip_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Animal_tenantId_microchip_key" ON public."Animal" USING btree ("tenantId", microchip);


--
-- Name: Animal_tenantId_placedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Animal_tenantId_placedAt_idx" ON public."Animal" USING btree ("tenantId", "placedAt");


--
-- Name: Animal_tenantId_species_primaryLineType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Animal_tenantId_species_primaryLineType_idx" ON public."Animal" USING btree ("tenantId", species, "primaryLineType");


--
-- Name: Animal_tenantId_species_sex_networkSearchVisible_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Animal_tenantId_species_sex_networkSearchVisible_idx" ON public."Animal" USING btree ("tenantId", species, sex, "networkSearchVisible");


--
-- Name: AssessmentResult_assignmentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AssessmentResult_assignmentId_idx" ON public."AssessmentResult" USING btree ("assignmentId");


--
-- Name: AssessmentResult_offspringId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AssessmentResult_offspringId_idx" ON public."AssessmentResult" USING btree ("offspringId");


--
-- Name: AssessmentResult_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AssessmentResult_tenantId_idx" ON public."AssessmentResult" USING btree ("tenantId");


--
-- Name: AssignmentOffspringOverride_assignmentId_offspringId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AssignmentOffspringOverride_assignmentId_offspringId_key" ON public."AssignmentOffspringOverride" USING btree ("assignmentId", "offspringId");


--
-- Name: Attachment_animalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Attachment_animalId_idx" ON public."Attachment" USING btree ("animalId");


--
-- Name: Attachment_attachmentPartyId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Attachment_attachmentPartyId_idx" ON public."Attachment" USING btree ("attachmentPartyId");


--
-- Name: Attachment_expenseId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Attachment_expenseId_idx" ON public."Attachment" USING btree ("expenseId");


--
-- Name: Attachment_invoiceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Attachment_invoiceId_idx" ON public."Attachment" USING btree ("invoiceId");


--
-- Name: Attachment_litterId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Attachment_litterId_idx" ON public."Attachment" USING btree ("litterId");


--
-- Name: Attachment_offspringGroupId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Attachment_offspringGroupId_idx" ON public."Attachment" USING btree ("offspringGroupId");


--
-- Name: Attachment_offspringId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Attachment_offspringId_idx" ON public."Attachment" USING btree ("offspringId");


--
-- Name: Attachment_paymentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Attachment_paymentId_idx" ON public."Attachment" USING btree ("paymentId");


--
-- Name: Attachment_planId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Attachment_planId_idx" ON public."Attachment" USING btree ("planId");


--
-- Name: Attachment_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Attachment_tenantId_idx" ON public."Attachment" USING btree ("tenantId");


--
-- Name: AuditEvent_action_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditEvent_action_createdAt_idx" ON public."AuditEvent" USING btree (action, "createdAt");


--
-- Name: AuditEvent_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditEvent_createdAt_idx" ON public."AuditEvent" USING btree ("createdAt");


--
-- Name: AuditEvent_tenantId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditEvent_tenantId_createdAt_idx" ON public."AuditEvent" USING btree ("tenantId", "createdAt");


--
-- Name: AuditEvent_userId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditEvent_userId_createdAt_idx" ON public."AuditEvent" USING btree ("userId", "createdAt");


--
-- Name: AutoReplyLog_ruleId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AutoReplyLog_ruleId_idx" ON public."AutoReplyLog" USING btree ("ruleId");


--
-- Name: AutoReplyLog_tenantId_channel_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AutoReplyLog_tenantId_channel_createdAt_idx" ON public."AutoReplyLog" USING btree ("tenantId", channel, "createdAt");


--
-- Name: AutoReplyLog_tenantId_partyId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AutoReplyLog_tenantId_partyId_idx" ON public."AutoReplyLog" USING btree ("tenantId", "partyId");


--
-- Name: AutoReplyLog_threadId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AutoReplyLog_threadId_idx" ON public."AutoReplyLog" USING btree ("threadId");


--
-- Name: AutoReplyRule_templateId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AutoReplyRule_templateId_idx" ON public."AutoReplyRule" USING btree ("templateId");


--
-- Name: AutoReplyRule_tenantId_channel_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AutoReplyRule_tenantId_channel_status_idx" ON public."AutoReplyRule" USING btree ("tenantId", channel, status);


--
-- Name: AutoReplyRule_tenantId_triggerType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AutoReplyRule_tenantId_triggerType_idx" ON public."AutoReplyRule" USING btree ("tenantId", "triggerType");


--
-- Name: BillingAccount_stripeCustomerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BillingAccount_stripeCustomerId_idx" ON public."BillingAccount" USING btree ("stripeCustomerId");


--
-- Name: BillingAccount_stripeCustomerId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "BillingAccount_stripeCustomerId_key" ON public."BillingAccount" USING btree ("stripeCustomerId");


--
-- Name: BillingAccount_tenantId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "BillingAccount_tenantId_key" ON public."BillingAccount" USING btree ("tenantId");


--
-- Name: BlockedEmail_blockedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BlockedEmail_blockedAt_idx" ON public."BlockedEmail" USING btree ("blockedAt");


--
-- Name: BlockedEmail_fromEmail_blockedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BlockedEmail_fromEmail_blockedAt_idx" ON public."BlockedEmail" USING btree ("fromEmail", "blockedAt");


--
-- Name: BlockedEmail_reason_blockedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BlockedEmail_reason_blockedAt_idx" ON public."BlockedEmail" USING btree (reason, "blockedAt");


--
-- Name: BlockedEmail_tenantId_blockedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BlockedEmail_tenantId_blockedAt_idx" ON public."BlockedEmail" USING btree ("tenantId", "blockedAt");


--
-- Name: BreedRegistryLink_registryId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedRegistryLink_registryId_idx" ON public."BreedRegistryLink" USING btree ("registryId");


--
-- Name: Breed_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Breed_name_key" ON public."Breed" USING btree (name);


--
-- Name: Breed_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Breed_slug_key" ON public."Breed" USING btree (slug);


--
-- Name: Breed_species_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Breed_species_idx" ON public."Breed" USING btree (species);


--
-- Name: BreederProfile_tenantId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "BreederProfile_tenantId_key" ON public."BreederProfile" USING btree ("tenantId");


--
-- Name: BreederReportFlag_breederTenantId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "BreederReportFlag_breederTenantId_key" ON public."BreederReportFlag" USING btree ("breederTenantId");


--
-- Name: BreederReportFlag_flaggedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreederReportFlag_flaggedAt_idx" ON public."BreederReportFlag" USING btree ("flaggedAt");


--
-- Name: BreederReportFlag_marketplaceSuspendedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreederReportFlag_marketplaceSuspendedAt_idx" ON public."BreederReportFlag" USING btree ("marketplaceSuspendedAt");


--
-- Name: BreederReportFlag_pendingReports_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreederReportFlag_pendingReports_idx" ON public."BreederReportFlag" USING btree ("pendingReports");


--
-- Name: BreederReport_breederTenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreederReport_breederTenantId_idx" ON public."BreederReport" USING btree ("breederTenantId");


--
-- Name: BreederReport_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreederReport_createdAt_idx" ON public."BreederReport" USING btree ("createdAt");


--
-- Name: BreederReport_reporterUserId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreederReport_reporterUserId_idx" ON public."BreederReport" USING btree ("reporterUserId");


--
-- Name: BreederReport_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreederReport_status_idx" ON public."BreederReport" USING btree (status);


--
-- Name: BreedingAttempt_damId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingAttempt_damId_idx" ON public."BreedingAttempt" USING btree ("damId");


--
-- Name: BreedingAttempt_planId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingAttempt_planId_idx" ON public."BreedingAttempt" USING btree ("planId");


--
-- Name: BreedingAttempt_sireId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingAttempt_sireId_idx" ON public."BreedingAttempt" USING btree ("sireId");


--
-- Name: BreedingAttempt_studOwnerPartyId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingAttempt_studOwnerPartyId_idx" ON public."BreedingAttempt" USING btree ("studOwnerPartyId");


--
-- Name: BreedingAttempt_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingAttempt_tenantId_idx" ON public."BreedingAttempt" USING btree ("tenantId");


--
-- Name: BreedingBooking_bookingNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "BreedingBooking_bookingNumber_key" ON public."BreedingBooking" USING btree ("bookingNumber");


--
-- Name: BreedingBooking_breedingPlanId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "BreedingBooking_breedingPlanId_key" ON public."BreedingBooking" USING btree ("breedingPlanId");


--
-- Name: BreedingBooking_offeringAnimalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingBooking_offeringAnimalId_idx" ON public."BreedingBooking" USING btree ("offeringAnimalId");


--
-- Name: BreedingBooking_offeringTenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingBooking_offeringTenantId_status_idx" ON public."BreedingBooking" USING btree ("offeringTenantId", status);


--
-- Name: BreedingBooking_seekingPartyId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingBooking_seekingPartyId_idx" ON public."BreedingBooking" USING btree ("seekingPartyId");


--
-- Name: BreedingBooking_seekingTenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingBooking_seekingTenantId_status_idx" ON public."BreedingBooking" USING btree ("seekingTenantId", status);


--
-- Name: BreedingBooking_semenUsageId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "BreedingBooking_semenUsageId_key" ON public."BreedingBooking" USING btree ("semenUsageId");


--
-- Name: BreedingBooking_sourceListingId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingBooking_sourceListingId_idx" ON public."BreedingBooking" USING btree ("sourceListingId");


--
-- Name: BreedingDataAgreement_approvingTenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingDataAgreement_approvingTenantId_status_idx" ON public."BreedingDataAgreement" USING btree ("approvingTenantId", status);


--
-- Name: BreedingDataAgreement_breedingPlanId_animalAccessId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "BreedingDataAgreement_breedingPlanId_animalAccessId_key" ON public."BreedingDataAgreement" USING btree ("breedingPlanId", "animalAccessId");


--
-- Name: BreedingDataAgreement_requestingTenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingDataAgreement_requestingTenantId_status_idx" ON public."BreedingDataAgreement" USING btree ("requestingTenantId", status);


--
-- Name: BreedingDataAgreement_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingDataAgreement_status_idx" ON public."BreedingDataAgreement" USING btree (status);


--
-- Name: BreedingDiscoveryProgram_programNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "BreedingDiscoveryProgram_programNumber_key" ON public."BreedingDiscoveryProgram" USING btree ("programNumber");


--
-- Name: BreedingDiscoveryProgram_publicEnabled_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingDiscoveryProgram_publicEnabled_status_idx" ON public."BreedingDiscoveryProgram" USING btree ("publicEnabled", status);


--
-- Name: BreedingDiscoveryProgram_publicSlug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingDiscoveryProgram_publicSlug_idx" ON public."BreedingDiscoveryProgram" USING btree ("publicSlug");


--
-- Name: BreedingDiscoveryProgram_publicSlug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "BreedingDiscoveryProgram_publicSlug_key" ON public."BreedingDiscoveryProgram" USING btree ("publicSlug");


--
-- Name: BreedingDiscoveryProgram_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingDiscoveryProgram_tenantId_status_idx" ON public."BreedingDiscoveryProgram" USING btree ("tenantId", status);


--
-- Name: BreedingEvent_breedingPlanId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingEvent_breedingPlanId_idx" ON public."BreedingEvent" USING btree ("breedingPlanId");


--
-- Name: BreedingEvent_tenantId_animalId_occurredAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingEvent_tenantId_animalId_occurredAt_idx" ON public."BreedingEvent" USING btree ("tenantId", "animalId", "occurredAt");


--
-- Name: BreedingEvent_tenantId_eventType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingEvent_tenantId_eventType_idx" ON public."BreedingEvent" USING btree ("tenantId", "eventType");


--
-- Name: BreedingGroupMember_breedingPlanId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingGroupMember_breedingPlanId_idx" ON public."BreedingGroupMember" USING btree ("breedingPlanId");


--
-- Name: BreedingGroupMember_breedingPlanId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "BreedingGroupMember_breedingPlanId_key" ON public."BreedingGroupMember" USING btree ("breedingPlanId");


--
-- Name: BreedingGroupMember_damId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingGroupMember_damId_idx" ON public."BreedingGroupMember" USING btree ("damId");


--
-- Name: BreedingGroupMember_expectedBirthStart_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingGroupMember_expectedBirthStart_idx" ON public."BreedingGroupMember" USING btree ("expectedBirthStart");


--
-- Name: BreedingGroupMember_groupId_damId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "BreedingGroupMember_groupId_damId_key" ON public."BreedingGroupMember" USING btree ("groupId", "damId");


--
-- Name: BreedingGroupMember_groupId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingGroupMember_groupId_idx" ON public."BreedingGroupMember" USING btree ("groupId");


--
-- Name: BreedingGroupMember_memberStatus_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingGroupMember_memberStatus_idx" ON public."BreedingGroupMember" USING btree ("memberStatus");


--
-- Name: BreedingGroupMember_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingGroupMember_tenantId_idx" ON public."BreedingGroupMember" USING btree ("tenantId");


--
-- Name: BreedingGroup_deletedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingGroup_deletedAt_idx" ON public."BreedingGroup" USING btree ("deletedAt");


--
-- Name: BreedingGroup_exposureStartDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingGroup_exposureStartDate_idx" ON public."BreedingGroup" USING btree ("exposureStartDate");


--
-- Name: BreedingGroup_organizationId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingGroup_organizationId_idx" ON public."BreedingGroup" USING btree ("organizationId");


--
-- Name: BreedingGroup_programId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingGroup_programId_idx" ON public."BreedingGroup" USING btree ("programId");


--
-- Name: BreedingGroup_sireId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingGroup_sireId_idx" ON public."BreedingGroup" USING btree ("sireId");


--
-- Name: BreedingGroup_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingGroup_tenantId_idx" ON public."BreedingGroup" USING btree ("tenantId");


--
-- Name: BreedingGroup_tenantId_species_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingGroup_tenantId_species_idx" ON public."BreedingGroup" USING btree ("tenantId", species);


--
-- Name: BreedingGroup_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingGroup_tenantId_status_idx" ON public."BreedingGroup" USING btree ("tenantId", status);


--
-- Name: BreedingInquiry_inquirerEmail_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingInquiry_inquirerEmail_idx" ON public."BreedingInquiry" USING btree ("inquirerEmail");


--
-- Name: BreedingInquiry_listingId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingInquiry_listingId_idx" ON public."BreedingInquiry" USING btree ("listingId");


--
-- Name: BreedingInquiry_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingInquiry_tenantId_status_idx" ON public."BreedingInquiry" USING btree ("tenantId", status);


--
-- Name: BreedingListing_animalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingListing_animalId_idx" ON public."BreedingListing" USING btree ("animalId");


--
-- Name: BreedingListing_listingNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "BreedingListing_listingNumber_key" ON public."BreedingListing" USING btree ("listingNumber");


--
-- Name: BreedingListing_locationState_species_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingListing_locationState_species_idx" ON public."BreedingListing" USING btree ("locationState", species);


--
-- Name: BreedingListing_programId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingListing_programId_idx" ON public."BreedingListing" USING btree ("programId");


--
-- Name: BreedingListing_publicEnabled_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingListing_publicEnabled_status_idx" ON public."BreedingListing" USING btree ("publicEnabled", status);


--
-- Name: BreedingListing_publicSlug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingListing_publicSlug_idx" ON public."BreedingListing" USING btree ("publicSlug");


--
-- Name: BreedingListing_publicSlug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "BreedingListing_publicSlug_key" ON public."BreedingListing" USING btree ("publicSlug");


--
-- Name: BreedingListing_species_breed_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingListing_species_breed_status_idx" ON public."BreedingListing" USING btree (species, breed, status);


--
-- Name: BreedingListing_species_intent_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingListing_species_intent_status_idx" ON public."BreedingListing" USING btree (species, intent, status);


--
-- Name: BreedingListing_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingListing_tenantId_status_idx" ON public."BreedingListing" USING btree ("tenantId", status);


--
-- Name: BreedingMilestone_breedingPlanId_scheduledDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingMilestone_breedingPlanId_scheduledDate_idx" ON public."BreedingMilestone" USING btree ("breedingPlanId", "scheduledDate");


--
-- Name: BreedingMilestone_scheduledDate_isCompleted_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingMilestone_scheduledDate_isCompleted_idx" ON public."BreedingMilestone" USING btree ("scheduledDate", "isCompleted");


--
-- Name: BreedingMilestone_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingMilestone_tenantId_idx" ON public."BreedingMilestone" USING btree ("tenantId");


--
-- Name: BreedingPlanBuyer_buyerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingPlanBuyer_buyerId_idx" ON public."BreedingPlanBuyer" USING btree ("buyerId");


--
-- Name: BreedingPlanBuyer_partyId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingPlanBuyer_partyId_idx" ON public."BreedingPlanBuyer" USING btree ("partyId");


--
-- Name: BreedingPlanBuyer_planId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingPlanBuyer_planId_idx" ON public."BreedingPlanBuyer" USING btree ("planId");


--
-- Name: BreedingPlanBuyer_planId_stage_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingPlanBuyer_planId_stage_idx" ON public."BreedingPlanBuyer" USING btree ("planId", stage);


--
-- Name: BreedingPlanBuyer_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingPlanBuyer_tenantId_idx" ON public."BreedingPlanBuyer" USING btree ("tenantId");


--
-- Name: BreedingPlanBuyer_waitlistEntryId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingPlanBuyer_waitlistEntryId_idx" ON public."BreedingPlanBuyer" USING btree ("waitlistEntryId");


--
-- Name: BreedingPlanEvent_planId_type_occurredAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingPlanEvent_planId_type_occurredAt_idx" ON public."BreedingPlanEvent" USING btree ("planId", type, "occurredAt");


--
-- Name: BreedingPlanEvent_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingPlanEvent_tenantId_idx" ON public."BreedingPlanEvent" USING btree ("tenantId");


--
-- Name: BreedingPlanTempLog_planId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingPlanTempLog_planId_idx" ON public."BreedingPlanTempLog" USING btree ("planId");


--
-- Name: BreedingPlanTempLog_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingPlanTempLog_tenantId_idx" ON public."BreedingPlanTempLog" USING btree ("tenantId");


--
-- Name: BreedingPlan_committedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingPlan_committedAt_idx" ON public."BreedingPlan" USING btree ("committedAt");


--
-- Name: BreedingPlan_cycleStartDateActual_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingPlan_cycleStartDateActual_idx" ON public."BreedingPlan" USING btree ("cycleStartDateActual");


--
-- Name: BreedingPlan_cycleStartObserved_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingPlan_cycleStartObserved_idx" ON public."BreedingPlan" USING btree ("cycleStartObserved");


--
-- Name: BreedingPlan_damId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingPlan_damId_idx" ON public."BreedingPlan" USING btree ("damId");


--
-- Name: BreedingPlan_deletedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingPlan_deletedAt_idx" ON public."BreedingPlan" USING btree ("deletedAt");


--
-- Name: BreedingPlan_expectedBirthDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingPlan_expectedBirthDate_idx" ON public."BreedingPlan" USING btree ("expectedBirthDate");


--
-- Name: BreedingPlan_expectedBreedDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingPlan_expectedBreedDate_idx" ON public."BreedingPlan" USING btree ("expectedBreedDate");


--
-- Name: BreedingPlan_expectedCycleStart_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingPlan_expectedCycleStart_idx" ON public."BreedingPlan" USING btree ("expectedCycleStart");


--
-- Name: BreedingPlan_expectedHormoneTestingStart_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingPlan_expectedHormoneTestingStart_idx" ON public."BreedingPlan" USING btree ("expectedHormoneTestingStart");


--
-- Name: BreedingPlan_expectedPlacementCompleted_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingPlan_expectedPlacementCompleted_idx" ON public."BreedingPlan" USING btree ("expectedPlacementCompleted");


--
-- Name: BreedingPlan_expectedPlacementStart_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingPlan_expectedPlacementStart_idx" ON public."BreedingPlan" USING btree ("expectedPlacementStart");


--
-- Name: BreedingPlan_expectedWeaned_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingPlan_expectedWeaned_idx" ON public."BreedingPlan" USING btree ("expectedWeaned");


--
-- Name: BreedingPlan_organizationId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingPlan_organizationId_idx" ON public."BreedingPlan" USING btree ("organizationId");


--
-- Name: BreedingPlan_ovulationConfirmed_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingPlan_ovulationConfirmed_idx" ON public."BreedingPlan" USING btree ("ovulationConfirmed");


--
-- Name: BreedingPlan_ovulationTestResultId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingPlan_ovulationTestResultId_idx" ON public."BreedingPlan" USING btree ("ovulationTestResultId");


--
-- Name: BreedingPlan_placementCompletedDateActual_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingPlan_placementCompletedDateActual_idx" ON public."BreedingPlan" USING btree ("placementCompletedDateActual");


--
-- Name: BreedingPlan_placementStartDateActual_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingPlan_placementStartDateActual_idx" ON public."BreedingPlan" USING btree ("placementStartDateActual");


--
-- Name: BreedingPlan_primaryAnchor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingPlan_primaryAnchor_idx" ON public."BreedingPlan" USING btree ("primaryAnchor");


--
-- Name: BreedingPlan_programId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingPlan_programId_idx" ON public."BreedingPlan" USING btree ("programId");


--
-- Name: BreedingPlan_reproAnchorMode_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingPlan_reproAnchorMode_idx" ON public."BreedingPlan" USING btree ("reproAnchorMode");


--
-- Name: BreedingPlan_sireId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingPlan_sireId_idx" ON public."BreedingPlan" USING btree ("sireId");


--
-- Name: BreedingPlan_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingPlan_status_idx" ON public."BreedingPlan" USING btree (status);


--
-- Name: BreedingPlan_tenantId_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "BreedingPlan_tenantId_code_key" ON public."BreedingPlan" USING btree ("tenantId", code);


--
-- Name: BreedingPlan_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingPlan_tenantId_idx" ON public."BreedingPlan" USING btree ("tenantId");


--
-- Name: BreedingPlan_tenantId_listingSlug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "BreedingPlan_tenantId_listingSlug_key" ON public."BreedingPlan" USING btree ("tenantId", "listingSlug") WHERE ("listingSlug" IS NOT NULL);


--
-- Name: BreedingProgramInquiry_buyerEmail_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingProgramInquiry_buyerEmail_idx" ON public."BreedingProgramInquiry" USING btree ("buyerEmail");


--
-- Name: BreedingProgramInquiry_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingProgramInquiry_createdAt_idx" ON public."BreedingProgramInquiry" USING btree ("createdAt");


--
-- Name: BreedingProgramInquiry_programId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingProgramInquiry_programId_status_idx" ON public."BreedingProgramInquiry" USING btree ("programId", status);


--
-- Name: BreedingProgramInquiry_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingProgramInquiry_tenantId_status_idx" ON public."BreedingProgramInquiry" USING btree ("tenantId", status);


--
-- Name: BreedingProgramMedia_programId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingProgramMedia_programId_idx" ON public."BreedingProgramMedia" USING btree ("programId");


--
-- Name: BreedingProgramMedia_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingProgramMedia_tenantId_idx" ON public."BreedingProgramMedia" USING btree ("tenantId");


--
-- Name: BreedingProgramRuleExecution_entityType_entityId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingProgramRuleExecution_entityType_entityId_idx" ON public."BreedingProgramRuleExecution" USING btree ("entityType", "entityId");


--
-- Name: BreedingProgramRuleExecution_executedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingProgramRuleExecution_executedAt_idx" ON public."BreedingProgramRuleExecution" USING btree ("executedAt");


--
-- Name: BreedingProgramRuleExecution_ruleId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingProgramRuleExecution_ruleId_idx" ON public."BreedingProgramRuleExecution" USING btree ("ruleId");


--
-- Name: BreedingProgramRuleExecution_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingProgramRuleExecution_tenantId_idx" ON public."BreedingProgramRuleExecution" USING btree ("tenantId");


--
-- Name: BreedingProgramRule_inheritsFromId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingProgramRule_inheritsFromId_idx" ON public."BreedingProgramRule" USING btree ("inheritsFromId");


--
-- Name: BreedingProgramRule_level_levelId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingProgramRule_level_levelId_idx" ON public."BreedingProgramRule" USING btree (level, "levelId");


--
-- Name: BreedingProgramRule_ruleType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingProgramRule_ruleType_idx" ON public."BreedingProgramRule" USING btree ("ruleType");


--
-- Name: BreedingProgramRule_tenantId_enabled_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingProgramRule_tenantId_enabled_idx" ON public."BreedingProgramRule" USING btree ("tenantId", enabled);


--
-- Name: BreedingProgramRule_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BreedingProgramRule_tenantId_idx" ON public."BreedingProgramRule" USING btree ("tenantId");


--
-- Name: BreedingProgramRule_tenantId_level_levelId_ruleType_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "BreedingProgramRule_tenantId_level_levelId_ruleType_key" ON public."BreedingProgramRule" USING btree ("tenantId", level, "levelId", "ruleType");


--
-- Name: BuyerEmailTemplate_tenantId_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BuyerEmailTemplate_tenantId_category_idx" ON public."BuyerEmailTemplate" USING btree ("tenantId", category);


--
-- Name: BuyerEmailTemplate_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BuyerEmailTemplate_tenantId_idx" ON public."BuyerEmailTemplate" USING btree ("tenantId");


--
-- Name: BuyerEmailTemplate_tenantId_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BuyerEmailTemplate_tenantId_isActive_idx" ON public."BuyerEmailTemplate" USING btree ("tenantId", "isActive");


--
-- Name: BuyerInterest_animalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BuyerInterest_animalId_idx" ON public."BuyerInterest" USING btree ("animalId");


--
-- Name: BuyerInterest_buyerId_animalId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "BuyerInterest_buyerId_animalId_key" ON public."BuyerInterest" USING btree ("buyerId", "animalId");


--
-- Name: BuyerInterest_buyerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BuyerInterest_buyerId_idx" ON public."BuyerInterest" USING btree ("buyerId");


--
-- Name: BuyerInterest_level_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BuyerInterest_level_idx" ON public."BuyerInterest" USING btree (level);


--
-- Name: BuyerTask_assignedToUserId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BuyerTask_assignedToUserId_idx" ON public."BuyerTask" USING btree ("assignedToUserId");


--
-- Name: BuyerTask_buyerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BuyerTask_buyerId_idx" ON public."BuyerTask" USING btree ("buyerId");


--
-- Name: BuyerTask_dealId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BuyerTask_dealId_idx" ON public."BuyerTask" USING btree ("dealId");


--
-- Name: BuyerTask_tenantId_dueAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BuyerTask_tenantId_dueAt_idx" ON public."BuyerTask" USING btree ("tenantId", "dueAt");


--
-- Name: BuyerTask_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BuyerTask_tenantId_idx" ON public."BuyerTask" USING btree ("tenantId");


--
-- Name: BuyerTask_tenantId_status_dueAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BuyerTask_tenantId_status_dueAt_idx" ON public."BuyerTask" USING btree ("tenantId", status, "dueAt");


--
-- Name: BuyerTask_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BuyerTask_tenantId_status_idx" ON public."BuyerTask" USING btree ("tenantId", status);


--
-- Name: Buyer_partyId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Buyer_partyId_idx" ON public."Buyer" USING btree ("partyId");


--
-- Name: Buyer_partyId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Buyer_partyId_key" ON public."Buyer" USING btree ("partyId");


--
-- Name: Buyer_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Buyer_status_idx" ON public."Buyer" USING btree (status);


--
-- Name: Buyer_tenantId_archivedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Buyer_tenantId_archivedAt_idx" ON public."Buyer" USING btree ("tenantId", "archivedAt");


--
-- Name: Buyer_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Buyer_tenantId_idx" ON public."Buyer" USING btree ("tenantId");


--
-- Name: Buyer_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Buyer_tenantId_status_idx" ON public."Buyer" USING btree ("tenantId", status);


--
-- Name: CampaignAttribution_campaignId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CampaignAttribution_campaignId_idx" ON public."CampaignAttribution" USING btree ("campaignId");


--
-- Name: CampaignAttribution_offspringId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CampaignAttribution_offspringId_idx" ON public."CampaignAttribution" USING btree ("offspringId");


--
-- Name: CampaignAttribution_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CampaignAttribution_tenantId_idx" ON public."CampaignAttribution" USING btree ("tenantId");


--
-- Name: Campaign_channel_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Campaign_channel_idx" ON public."Campaign" USING btree (channel);


--
-- Name: Campaign_offspringGroupId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Campaign_offspringGroupId_idx" ON public."Campaign" USING btree ("offspringGroupId");


--
-- Name: Campaign_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Campaign_tenantId_idx" ON public."Campaign" USING btree ("tenantId");


--
-- Name: CompetitionEntryDocument_competitionEntryId_documentId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CompetitionEntryDocument_competitionEntryId_documentId_key" ON public."CompetitionEntryDocument" USING btree ("competitionEntryId", "documentId");


--
-- Name: CompetitionEntry_animalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CompetitionEntry_animalId_idx" ON public."CompetitionEntry" USING btree ("animalId");


--
-- Name: CompetitionEntry_competitionType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CompetitionEntry_competitionType_idx" ON public."CompetitionEntry" USING btree ("competitionType");


--
-- Name: CompetitionEntry_eventDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CompetitionEntry_eventDate_idx" ON public."CompetitionEntry" USING btree ("eventDate");


--
-- Name: CompetitionEntry_isPublic_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CompetitionEntry_isPublic_idx" ON public."CompetitionEntry" USING btree ("isPublic");


--
-- Name: CompetitionEntry_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CompetitionEntry_tenantId_idx" ON public."CompetitionEntry" USING btree ("tenantId");


--
-- Name: ContactChangeRequest_contactId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ContactChangeRequest_contactId_idx" ON public."ContactChangeRequest" USING btree ("contactId");


--
-- Name: ContactChangeRequest_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ContactChangeRequest_tenantId_status_idx" ON public."ContactChangeRequest" USING btree ("tenantId", status);


--
-- Name: Contact_archived_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Contact_archived_idx" ON public."Contact" USING btree (archived);


--
-- Name: Contact_deletedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Contact_deletedAt_idx" ON public."Contact" USING btree ("deletedAt");


--
-- Name: Contact_display_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Contact_display_name_idx" ON public."Contact" USING btree (display_name);


--
-- Name: Contact_first_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Contact_first_name_idx" ON public."Contact" USING btree (first_name);


--
-- Name: Contact_last_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Contact_last_name_idx" ON public."Contact" USING btree (last_name);


--
-- Name: Contact_marketplaceUserId_tenantId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Contact_marketplaceUserId_tenantId_key" ON public."Contact" USING btree ("marketplaceUserId", "tenantId");


--
-- Name: Contact_nickname_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Contact_nickname_idx" ON public."Contact" USING btree (nickname);


--
-- Name: Contact_organizationId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Contact_organizationId_idx" ON public."Contact" USING btree ("organizationId");


--
-- Name: Contact_partyId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Contact_partyId_key" ON public."Contact" USING btree ("partyId");


--
-- Name: Contact_tenantId_deletedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Contact_tenantId_deletedAt_idx" ON public."Contact" USING btree ("tenantId", "deletedAt");


--
-- Name: Contact_tenantId_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Contact_tenantId_email_key" ON public."Contact" USING btree ("tenantId", email);


--
-- Name: Contact_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Contact_tenantId_idx" ON public."Contact" USING btree ("tenantId");


--
-- Name: Contact_tenantId_partyId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Contact_tenantId_partyId_idx" ON public."Contact" USING btree ("tenantId", "partyId");


--
-- Name: ContractContent_contractId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ContractContent_contractId_key" ON public."ContractContent" USING btree ("contractId");


--
-- Name: ContractParty_contractId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ContractParty_contractId_idx" ON public."ContractParty" USING btree ("contractId");


--
-- Name: ContractParty_partyId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ContractParty_partyId_idx" ON public."ContractParty" USING btree ("partyId");


--
-- Name: ContractParty_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ContractParty_status_idx" ON public."ContractParty" USING btree (status);


--
-- Name: ContractParty_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ContractParty_tenantId_idx" ON public."ContractParty" USING btree ("tenantId");


--
-- Name: ContractParty_tenantId_partyId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ContractParty_tenantId_partyId_idx" ON public."ContractParty" USING btree ("tenantId", "partyId");


--
-- Name: ContractTemplate_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ContractTemplate_category_idx" ON public."ContractTemplate" USING btree (category);


--
-- Name: ContractTemplate_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ContractTemplate_isActive_idx" ON public."ContractTemplate" USING btree ("isActive");


--
-- Name: ContractTemplate_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ContractTemplate_slug_key" ON public."ContractTemplate" USING btree (slug);


--
-- Name: ContractTemplate_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ContractTemplate_tenantId_idx" ON public."ContractTemplate" USING btree ("tenantId");


--
-- Name: ContractTemplate_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ContractTemplate_type_idx" ON public."ContractTemplate" USING btree (type);


--
-- Name: Contract_animalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Contract_animalId_idx" ON public."Contract" USING btree ("animalId");


--
-- Name: Contract_expiresAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Contract_expiresAt_idx" ON public."Contract" USING btree ("expiresAt");


--
-- Name: Contract_invoiceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Contract_invoiceId_idx" ON public."Contract" USING btree ("invoiceId");


--
-- Name: Contract_invoiceId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Contract_invoiceId_key" ON public."Contract" USING btree ("invoiceId");


--
-- Name: Contract_offspringId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Contract_offspringId_idx" ON public."Contract" USING btree ("offspringId");


--
-- Name: Contract_provider_providerEnvelopeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Contract_provider_providerEnvelopeId_idx" ON public."Contract" USING btree (provider, "providerEnvelopeId");


--
-- Name: Contract_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Contract_status_idx" ON public."Contract" USING btree (status);


--
-- Name: Contract_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Contract_tenantId_idx" ON public."Contract" USING btree ("tenantId");


--
-- Name: Contract_waitlistEntryId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Contract_waitlistEntryId_idx" ON public."Contract" USING btree ("waitlistEntryId");


--
-- Name: CrossTenantAnimalLink_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CrossTenantAnimalLink_active_idx" ON public."CrossTenantAnimalLink" USING btree (active);


--
-- Name: CrossTenantAnimalLink_childAnimalId_parentType_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CrossTenantAnimalLink_childAnimalId_parentType_key" ON public."CrossTenantAnimalLink" USING btree ("childAnimalId", "parentType");


--
-- Name: CrossTenantAnimalLink_childTenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CrossTenantAnimalLink_childTenantId_idx" ON public."CrossTenantAnimalLink" USING btree ("childTenantId");


--
-- Name: CrossTenantAnimalLink_linkRequestId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CrossTenantAnimalLink_linkRequestId_key" ON public."CrossTenantAnimalLink" USING btree ("linkRequestId");


--
-- Name: CrossTenantAnimalLink_parentAnimalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CrossTenantAnimalLink_parentAnimalId_idx" ON public."CrossTenantAnimalLink" USING btree ("parentAnimalId");


--
-- Name: CrossTenantAnimalLink_parentTenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CrossTenantAnimalLink_parentTenantId_idx" ON public."CrossTenantAnimalLink" USING btree ("parentTenantId");


--
-- Name: CustomBreed_id_tenantId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CustomBreed_id_tenantId_key" ON public."CustomBreed" USING btree (id, "tenantId");


--
-- Name: CustomBreed_tenantId_createdByOrganizationId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CustomBreed_tenantId_createdByOrganizationId_idx" ON public."CustomBreed" USING btree ("tenantId", "createdByOrganizationId");


--
-- Name: CustomBreed_tenantId_species_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CustomBreed_tenantId_species_idx" ON public."CustomBreed" USING btree ("tenantId", species);


--
-- Name: CustomBreed_tenantId_species_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CustomBreed_tenantId_species_name_key" ON public."CustomBreed" USING btree ("tenantId", species, name);


--
-- Name: DHIATestRecord_animalId_testDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DHIATestRecord_animalId_testDate_idx" ON public."DHIATestRecord" USING btree ("animalId", "testDate");


--
-- Name: DHIATestRecord_lactationCycleId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DHIATestRecord_lactationCycleId_idx" ON public."DHIATestRecord" USING btree ("lactationCycleId");


--
-- Name: DHIATestRecord_tenantId_animalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DHIATestRecord_tenantId_animalId_idx" ON public."DHIATestRecord" USING btree ("tenantId", "animalId");


--
-- Name: DHIATestRecord_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DHIATestRecord_tenantId_idx" ON public."DHIATestRecord" USING btree ("tenantId");


--
-- Name: DairyProductionHistory_animalId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "DairyProductionHistory_animalId_key" ON public."DairyProductionHistory" USING btree ("animalId");


--
-- Name: DairyProductionHistory_tenantId_animalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DairyProductionHistory_tenantId_animalId_idx" ON public."DairyProductionHistory" USING btree ("tenantId", "animalId");


--
-- Name: DairyProductionHistory_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DairyProductionHistory_tenantId_idx" ON public."DairyProductionHistory" USING btree ("tenantId");


--
-- Name: DealActivity_dealId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DealActivity_dealId_createdAt_idx" ON public."DealActivity" USING btree ("dealId", "createdAt");


--
-- Name: DealActivity_dealId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DealActivity_dealId_idx" ON public."DealActivity" USING btree ("dealId");


--
-- Name: DealActivity_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DealActivity_tenantId_idx" ON public."DealActivity" USING btree ("tenantId");


--
-- Name: DealActivity_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DealActivity_type_idx" ON public."DealActivity" USING btree (type);


--
-- Name: Deal_animalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Deal_animalId_idx" ON public."Deal" USING btree ("animalId");


--
-- Name: Deal_buyerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Deal_buyerId_idx" ON public."Deal" USING btree ("buyerId");


--
-- Name: Deal_outcome_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Deal_outcome_idx" ON public."Deal" USING btree (outcome);


--
-- Name: Deal_stage_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Deal_stage_idx" ON public."Deal" USING btree (stage);


--
-- Name: Deal_tenantId_buyerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Deal_tenantId_buyerId_idx" ON public."Deal" USING btree ("tenantId", "buyerId");


--
-- Name: Deal_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Deal_tenantId_idx" ON public."Deal" USING btree ("tenantId");


--
-- Name: Deal_tenantId_stage_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Deal_tenantId_stage_idx" ON public."Deal" USING btree ("tenantId", stage);


--
-- Name: DocumentBundleItem_bundleId_documentId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "DocumentBundleItem_bundleId_documentId_key" ON public."DocumentBundleItem" USING btree ("bundleId", "documentId");


--
-- Name: DocumentBundleItem_bundleId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DocumentBundleItem_bundleId_idx" ON public."DocumentBundleItem" USING btree ("bundleId");


--
-- Name: DocumentBundleItem_documentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DocumentBundleItem_documentId_idx" ON public."DocumentBundleItem" USING btree ("documentId");


--
-- Name: DocumentBundle_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DocumentBundle_tenantId_idx" ON public."DocumentBundle" USING btree ("tenantId");


--
-- Name: DocumentBundle_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DocumentBundle_tenantId_status_idx" ON public."DocumentBundle" USING btree ("tenantId", status);


--
-- Name: Document_invoiceId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Document_invoiceId_key" ON public."Document" USING btree ("invoiceId");


--
-- Name: Document_kind_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Document_kind_idx" ON public."Document" USING btree (kind);


--
-- Name: Document_scope_contractId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Document_scope_contractId_idx" ON public."Document" USING btree (scope, "contractId");


--
-- Name: Document_scope_invoiceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Document_scope_invoiceId_idx" ON public."Document" USING btree (scope, "invoiceId");


--
-- Name: Document_scope_offspringId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Document_scope_offspringId_idx" ON public."Document" USING btree (scope, "offspringId");


--
-- Name: Document_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Document_tenantId_idx" ON public."Document" USING btree ("tenantId");


--
-- Name: Draft_tenantId_channel_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Draft_tenantId_channel_idx" ON public."Draft" USING btree ("tenantId", channel);


--
-- Name: Draft_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Draft_tenantId_idx" ON public."Draft" USING btree ("tenantId");


--
-- Name: Draft_tenantId_partyId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Draft_tenantId_partyId_idx" ON public."Draft" USING btree ("tenantId", "partyId");


--
-- Name: Draft_tenantId_updatedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Draft_tenantId_updatedAt_idx" ON public."Draft" USING btree ("tenantId", "updatedAt");


--
-- Name: EmailChangeRequest_contactId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EmailChangeRequest_contactId_idx" ON public."EmailChangeRequest" USING btree ("contactId");


--
-- Name: EmailChangeRequest_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EmailChangeRequest_tenantId_idx" ON public."EmailChangeRequest" USING btree ("tenantId");


--
-- Name: EmailChangeRequest_verificationToken_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EmailChangeRequest_verificationToken_idx" ON public."EmailChangeRequest" USING btree ("verificationToken");


--
-- Name: EmailChangeRequest_verificationToken_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "EmailChangeRequest_verificationToken_key" ON public."EmailChangeRequest" USING btree ("verificationToken");


--
-- Name: EmailFilter_tenantId_pattern_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EmailFilter_tenantId_pattern_idx" ON public."EmailFilter" USING btree ("tenantId", pattern);


--
-- Name: EmailFilter_tenantId_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EmailFilter_tenantId_type_idx" ON public."EmailFilter" USING btree ("tenantId", type);


--
-- Name: EmailSendLog_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EmailSendLog_createdAt_idx" ON public."EmailSendLog" USING btree ("createdAt");


--
-- Name: EmailSendLog_providerMessageId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EmailSendLog_providerMessageId_idx" ON public."EmailSendLog" USING btree ("providerMessageId");


--
-- Name: EmailSendLog_relatedInvoiceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EmailSendLog_relatedInvoiceId_idx" ON public."EmailSendLog" USING btree ("relatedInvoiceId");


--
-- Name: EmailSendLog_templateId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EmailSendLog_templateId_idx" ON public."EmailSendLog" USING btree ("templateId");


--
-- Name: EmailSendLog_tenantId_archived_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EmailSendLog_tenantId_archived_idx" ON public."EmailSendLog" USING btree ("tenantId", archived);


--
-- Name: EmailSendLog_tenantId_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EmailSendLog_tenantId_category_idx" ON public."EmailSendLog" USING btree ("tenantId", category);


--
-- Name: EmailSendLog_tenantId_flagged_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EmailSendLog_tenantId_flagged_idx" ON public."EmailSendLog" USING btree ("tenantId", flagged);


--
-- Name: EmailSendLog_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EmailSendLog_tenantId_idx" ON public."EmailSendLog" USING btree ("tenantId");


--
-- Name: EmailSendLog_tenantId_partyId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EmailSendLog_tenantId_partyId_idx" ON public."EmailSendLog" USING btree ("tenantId", "partyId");


--
-- Name: EmailSendLog_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EmailSendLog_tenantId_status_idx" ON public."EmailSendLog" USING btree ("tenantId", status);


--
-- Name: EmailSendLog_tenantId_templateKey_relatedInvoiceId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "EmailSendLog_tenantId_templateKey_relatedInvoiceId_key" ON public."EmailSendLog" USING btree ("tenantId", "templateKey", "relatedInvoiceId");


--
-- Name: Expense_tenantId_animalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Expense_tenantId_animalId_idx" ON public."Expense" USING btree ("tenantId", "animalId");


--
-- Name: Expense_tenantId_breedingPlanId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Expense_tenantId_breedingPlanId_idx" ON public."Expense" USING btree ("tenantId", "breedingPlanId");


--
-- Name: Expense_tenantId_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Expense_tenantId_category_idx" ON public."Expense" USING btree ("tenantId", category);


--
-- Name: Expense_tenantId_foodProductId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Expense_tenantId_foodProductId_idx" ON public."Expense" USING btree ("tenantId", "foodProductId");


--
-- Name: Expense_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Expense_tenantId_idx" ON public."Expense" USING btree ("tenantId");


--
-- Name: Expense_tenantId_incurredAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Expense_tenantId_incurredAt_idx" ON public."Expense" USING btree ("tenantId", "incurredAt");


--
-- Name: Expense_tenantId_vendorPartyId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Expense_tenantId_vendorPartyId_idx" ON public."Expense" USING btree ("tenantId", "vendorPartyId");


--
-- Name: FeatureCheckDaily_date_featureKey_tenantId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "FeatureCheckDaily_date_featureKey_tenantId_key" ON public."FeatureCheckDaily" USING btree (date, "featureKey", "tenantId");


--
-- Name: FeatureCheckDaily_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FeatureCheckDaily_date_idx" ON public."FeatureCheckDaily" USING btree (date);


--
-- Name: FeatureCheckDaily_featureKey_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FeatureCheckDaily_featureKey_idx" ON public."FeatureCheckDaily" USING btree ("featureKey");


--
-- Name: FeatureCheckDaily_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FeatureCheckDaily_tenantId_idx" ON public."FeatureCheckDaily" USING btree ("tenantId");


--
-- Name: FeatureCheck_featureKey_timestamp_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FeatureCheck_featureKey_timestamp_idx" ON public."FeatureCheck" USING btree ("featureKey", "timestamp");


--
-- Name: FeatureCheck_granted_timestamp_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FeatureCheck_granted_timestamp_idx" ON public."FeatureCheck" USING btree (granted, "timestamp");


--
-- Name: FeatureCheck_tenantId_timestamp_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FeatureCheck_tenantId_timestamp_idx" ON public."FeatureCheck" USING btree ("tenantId", "timestamp");


--
-- Name: FeatureCheck_timestamp_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FeatureCheck_timestamp_idx" ON public."FeatureCheck" USING btree ("timestamp");


--
-- Name: Feature_entitlementKey_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Feature_entitlementKey_idx" ON public."Feature" USING btree ("entitlementKey");


--
-- Name: Feature_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Feature_isActive_idx" ON public."Feature" USING btree ("isActive");


--
-- Name: Feature_key_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Feature_key_key" ON public."Feature" USING btree (key);


--
-- Name: Feature_module_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Feature_module_idx" ON public."Feature" USING btree (module);


--
-- Name: FeedingPlan_animalId_startDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FeedingPlan_animalId_startDate_idx" ON public."FeedingPlan" USING btree ("animalId", "startDate");


--
-- Name: FeedingPlan_breedingPlanId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FeedingPlan_breedingPlanId_idx" ON public."FeedingPlan" USING btree ("tenantId", "breedingPlanId");


--
-- Name: FeedingPlan_tenantId_animalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FeedingPlan_tenantId_animalId_idx" ON public."FeedingPlan" USING btree ("tenantId", "animalId");


--
-- Name: FeedingPlan_tenantId_animalId_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FeedingPlan_tenantId_animalId_isActive_idx" ON public."FeedingPlan" USING btree ("tenantId", "animalId", "isActive");


--
-- Name: FeedingPlan_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FeedingPlan_tenantId_idx" ON public."FeedingPlan" USING btree ("tenantId");


--
-- Name: FeedingRecord_breedingPlanId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FeedingRecord_breedingPlanId_idx" ON public."FeedingRecord" USING btree ("tenantId", "breedingPlanId");


--
-- Name: FeedingRecord_expenseId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "FeedingRecord_expenseId_key" ON public."FeedingRecord" USING btree ("expenseId");


--
-- Name: FeedingRecord_fedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FeedingRecord_fedAt_idx" ON public."FeedingRecord" USING btree ("fedAt");


--
-- Name: FeedingRecord_tenantId_animalId_fedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FeedingRecord_tenantId_animalId_fedAt_idx" ON public."FeedingRecord" USING btree ("tenantId", "animalId", "fedAt");


--
-- Name: FeedingRecord_tenantId_animalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FeedingRecord_tenantId_animalId_idx" ON public."FeedingRecord" USING btree ("tenantId", "animalId");


--
-- Name: FeedingRecord_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FeedingRecord_tenantId_idx" ON public."FeedingRecord" USING btree ("tenantId");


--
-- Name: FiberLabTest_animalId_testDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FiberLabTest_animalId_testDate_idx" ON public."FiberLabTest" USING btree ("animalId", "testDate");


--
-- Name: FiberLabTest_shearingRecordId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FiberLabTest_shearingRecordId_idx" ON public."FiberLabTest" USING btree ("shearingRecordId");


--
-- Name: FiberLabTest_tenantId_animalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FiberLabTest_tenantId_animalId_idx" ON public."FiberLabTest" USING btree ("tenantId", "animalId");


--
-- Name: FiberLabTest_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FiberLabTest_tenantId_idx" ON public."FiberLabTest" USING btree ("tenantId");


--
-- Name: FiberProductionHistory_animalId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "FiberProductionHistory_animalId_key" ON public."FiberProductionHistory" USING btree ("animalId");


--
-- Name: FiberProductionHistory_tenantId_animalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FiberProductionHistory_tenantId_animalId_idx" ON public."FiberProductionHistory" USING btree ("tenantId", "animalId");


--
-- Name: FiberProductionHistory_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FiberProductionHistory_tenantId_idx" ON public."FiberProductionHistory" USING btree ("tenantId");


--
-- Name: FoalingCheck_breedingPlanId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FoalingCheck_breedingPlanId_idx" ON public."FoalingCheck" USING btree ("breedingPlanId");


--
-- Name: FoalingCheck_checkedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FoalingCheck_checkedAt_idx" ON public."FoalingCheck" USING btree ("checkedAt");


--
-- Name: FoalingCheck_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FoalingCheck_tenantId_idx" ON public."FoalingCheck" USING btree ("tenantId");


--
-- Name: FoalingOutcome_breedingPlanId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FoalingOutcome_breedingPlanId_idx" ON public."FoalingOutcome" USING btree ("breedingPlanId");


--
-- Name: FoalingOutcome_breedingPlanId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "FoalingOutcome_breedingPlanId_key" ON public."FoalingOutcome" USING btree ("breedingPlanId");


--
-- Name: FoalingOutcome_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FoalingOutcome_tenantId_idx" ON public."FoalingOutcome" USING btree ("tenantId");


--
-- Name: FoodChange_animalId_changeDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FoodChange_animalId_changeDate_idx" ON public."FoodChange" USING btree ("animalId", "changeDate");


--
-- Name: FoodChange_tenantId_animalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FoodChange_tenantId_animalId_idx" ON public."FoodChange" USING btree ("tenantId", "animalId");


--
-- Name: FoodChange_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FoodChange_tenantId_idx" ON public."FoodChange" USING btree ("tenantId");


--
-- Name: FoodProduct_tenantId_foodType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FoodProduct_tenantId_foodType_idx" ON public."FoodProduct" USING btree ("tenantId", "foodType");


--
-- Name: FoodProduct_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FoodProduct_tenantId_idx" ON public."FoodProduct" USING btree ("tenantId");


--
-- Name: FoodProduct_tenantId_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FoodProduct_tenantId_isActive_idx" ON public."FoodProduct" USING btree ("tenantId", "isActive");


--
-- Name: FoodProduct_tenantId_species_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FoodProduct_tenantId_species_idx" ON public."FoodProduct" USING btree ("tenantId", species);


--
-- Name: GeneticNotificationPreference_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "GeneticNotificationPreference_tenantId_idx" ON public."GeneticNotificationPreference" USING btree ("tenantId");


--
-- Name: GeneticNotificationPreference_userId_tenantId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "GeneticNotificationPreference_userId_tenantId_key" ON public."GeneticNotificationPreference" USING btree ("userId", "tenantId");


--
-- Name: GeneticNotificationSnooze_animalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "GeneticNotificationSnooze_animalId_idx" ON public."GeneticNotificationSnooze" USING btree ("animalId");


--
-- Name: GeneticNotificationSnooze_tenantId_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "GeneticNotificationSnooze_tenantId_userId_idx" ON public."GeneticNotificationSnooze" USING btree ("tenantId", "userId");


--
-- Name: GeneticNotificationSnooze_userId_tenantId_snoozeType_animal_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "GeneticNotificationSnooze_userId_tenantId_snoozeType_animal_key" ON public."GeneticNotificationSnooze" USING btree ("userId", "tenantId", "snoozeType", "animalId", "testCode");


--
-- Name: GeneticsDisclaimerAcceptance_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "GeneticsDisclaimerAcceptance_userId_idx" ON public."GeneticsDisclaimerAcceptance" USING btree ("userId");


--
-- Name: GlobalAnimalIdentifier_identityId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "GlobalAnimalIdentifier_identityId_idx" ON public."GlobalAnimalIdentifier" USING btree ("identityId");


--
-- Name: GlobalAnimalIdentifier_type_value_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "GlobalAnimalIdentifier_type_value_idx" ON public."GlobalAnimalIdentifier" USING btree (type, value);


--
-- Name: GlobalAnimalIdentifier_type_value_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "GlobalAnimalIdentifier_type_value_key" ON public."GlobalAnimalIdentifier" USING btree (type, value);


--
-- Name: GlobalAnimalIdentity_damId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "GlobalAnimalIdentity_damId_idx" ON public."GlobalAnimalIdentity" USING btree ("damId");


--
-- Name: GlobalAnimalIdentity_gaid_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "GlobalAnimalIdentity_gaid_key" ON public."GlobalAnimalIdentity" USING btree (gaid);


--
-- Name: GlobalAnimalIdentity_sireId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "GlobalAnimalIdentity_sireId_idx" ON public."GlobalAnimalIdentity" USING btree ("sireId");


--
-- Name: GlobalAnimalIdentity_species_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "GlobalAnimalIdentity_species_idx" ON public."GlobalAnimalIdentity" USING btree (species);


--
-- Name: HealthEvent_kind_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "HealthEvent_kind_idx" ON public."HealthEvent" USING btree (kind);


--
-- Name: HealthEvent_offspringId_occurredAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "HealthEvent_offspringId_occurredAt_idx" ON public."HealthEvent" USING btree ("offspringId", "occurredAt");


--
-- Name: HealthEvent_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "HealthEvent_tenantId_idx" ON public."HealthEvent" USING btree ("tenantId");


--
-- Name: IdempotencyKey_tenantId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IdempotencyKey_tenantId_createdAt_idx" ON public."IdempotencyKey" USING btree ("tenantId", "createdAt");


--
-- Name: IdempotencyKey_tenantId_key_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IdempotencyKey_tenantId_key_key" ON public."IdempotencyKey" USING btree ("tenantId", key);


--
-- Name: Invite_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Invite_email_idx" ON public."Invite" USING btree (email);


--
-- Name: Invite_token_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Invite_token_idx" ON public."Invite" USING btree (token);


--
-- Name: Invite_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Invite_token_key" ON public."Invite" USING btree (token);


--
-- Name: InvoiceLineItem_invoiceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InvoiceLineItem_invoiceId_idx" ON public."InvoiceLineItem" USING btree ("invoiceId");


--
-- Name: InvoiceLineItem_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InvoiceLineItem_tenantId_idx" ON public."InvoiceLineItem" USING btree ("tenantId");


--
-- Name: Invoice_breedingPlanBuyerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Invoice_breedingPlanBuyerId_idx" ON public."Invoice" USING btree ("breedingPlanBuyerId");


--
-- Name: Invoice_clientPartyId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Invoice_clientPartyId_idx" ON public."Invoice" USING btree ("clientPartyId");


--
-- Name: Invoice_clientPartyId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Invoice_clientPartyId_status_idx" ON public."Invoice" USING btree ("clientPartyId", status);


--
-- Name: Invoice_deletedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Invoice_deletedAt_idx" ON public."Invoice" USING btree ("deletedAt");


--
-- Name: Invoice_offspringGroupBuyerId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Invoice_offspringGroupBuyerId_key" ON public."Invoice" USING btree ("offspringGroupBuyerId");


--
-- Name: Invoice_scope_offspringId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Invoice_scope_offspringId_idx" ON public."Invoice" USING btree (scope, "offspringId");


--
-- Name: Invoice_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Invoice_status_idx" ON public."Invoice" USING btree (status);


--
-- Name: Invoice_stripeInvoiceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Invoice_stripeInvoiceId_idx" ON public."Invoice" USING btree ("stripeInvoiceId");


--
-- Name: Invoice_tenantId_animalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Invoice_tenantId_animalId_idx" ON public."Invoice" USING btree ("tenantId", "animalId");


--
-- Name: Invoice_tenantId_breedingPlanId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Invoice_tenantId_breedingPlanId_idx" ON public."Invoice" USING btree ("tenantId", "breedingPlanId");


--
-- Name: Invoice_tenantId_clientPartyId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Invoice_tenantId_clientPartyId_status_idx" ON public."Invoice" USING btree ("tenantId", "clientPartyId", status);


--
-- Name: Invoice_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Invoice_tenantId_idx" ON public."Invoice" USING btree ("tenantId");


--
-- Name: Invoice_tenantId_invoiceNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Invoice_tenantId_invoiceNumber_key" ON public."Invoice" USING btree ("tenantId", "invoiceNumber");


--
-- Name: Invoice_tenantId_isMarketplaceInvoice_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Invoice_tenantId_isMarketplaceInvoice_status_idx" ON public."Invoice" USING btree ("tenantId", "isMarketplaceInvoice", status);


--
-- Name: Invoice_tenantId_offspringId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Invoice_tenantId_offspringId_idx" ON public."Invoice" USING btree ("tenantId", "offspringId");


--
-- Name: Invoice_tenantId_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Invoice_tenantId_status_createdAt_idx" ON public."Invoice" USING btree ("tenantId", status, "createdAt" DESC);


--
-- Name: Invoice_waitlistEntryId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Invoice_waitlistEntryId_key" ON public."Invoice" USING btree ("waitlistEntryId");


--
-- Name: LactationCycle_animalId_freshenDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LactationCycle_animalId_freshenDate_idx" ON public."LactationCycle" USING btree ("animalId", "freshenDate");


--
-- Name: LactationCycle_animalId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LactationCycle_animalId_status_idx" ON public."LactationCycle" USING btree ("animalId", status);


--
-- Name: LactationCycle_tenantId_animalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LactationCycle_tenantId_animalId_idx" ON public."LactationCycle" USING btree ("tenantId", "animalId");


--
-- Name: LactationCycle_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LactationCycle_tenantId_idx" ON public."LactationCycle" USING btree ("tenantId");


--
-- Name: LinearAppraisal_animalId_appraisalDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LinearAppraisal_animalId_appraisalDate_idx" ON public."LinearAppraisal" USING btree ("animalId", "appraisalDate");


--
-- Name: LinearAppraisal_tenantId_animalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LinearAppraisal_tenantId_animalId_idx" ON public."LinearAppraisal" USING btree ("tenantId", "animalId");


--
-- Name: LinearAppraisal_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LinearAppraisal_tenantId_idx" ON public."LinearAppraisal" USING btree ("tenantId");


--
-- Name: ListingBoost_listingType_listingId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ListingBoost_listingType_listingId_idx" ON public."ListingBoost" USING btree ("listingType", "listingId");


--
-- Name: ListingBoost_listingType_status_tier_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ListingBoost_listingType_status_tier_idx" ON public."ListingBoost" USING btree ("listingType", status, tier);


--
-- Name: ListingBoost_providerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ListingBoost_providerId_idx" ON public."ListingBoost" USING btree ("providerId");


--
-- Name: ListingBoost_status_expiresAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ListingBoost_status_expiresAt_idx" ON public."ListingBoost" USING btree (status, "expiresAt");


--
-- Name: ListingBoost_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ListingBoost_tenantId_idx" ON public."ListingBoost" USING btree ("tenantId");


--
-- Name: LitterEvent_litterId_type_occurredAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LitterEvent_litterId_type_occurredAt_idx" ON public."LitterEvent" USING btree ("litterId", type, "occurredAt");


--
-- Name: LitterEvent_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LitterEvent_tenantId_idx" ON public."LitterEvent" USING btree ("tenantId");


--
-- Name: Litter_planId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Litter_planId_key" ON public."Litter" USING btree ("planId");


--
-- Name: Litter_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Litter_tenantId_idx" ON public."Litter" USING btree ("tenantId");


--
-- Name: Litter_tenantId_placementCompletedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Litter_tenantId_placementCompletedAt_idx" ON public."Litter" USING btree ("tenantId", "placementCompletedAt");


--
-- Name: Litter_tenantId_placementStartAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Litter_tenantId_placementStartAt_idx" ON public."Litter" USING btree ("tenantId", "placementStartAt");


--
-- Name: Litter_tenantId_weanedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Litter_tenantId_weanedAt_idx" ON public."Litter" USING btree ("tenantId", "weanedAt");


--
-- Name: MareReproductiveHistory_mareId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MareReproductiveHistory_mareId_idx" ON public."MareReproductiveHistory" USING btree ("mareId");


--
-- Name: MareReproductiveHistory_mareId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "MareReproductiveHistory_mareId_key" ON public."MareReproductiveHistory" USING btree ("mareId");


--
-- Name: MareReproductiveHistory_riskScore_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MareReproductiveHistory_riskScore_idx" ON public."MareReproductiveHistory" USING btree ("riskScore");


--
-- Name: MareReproductiveHistory_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MareReproductiveHistory_tenantId_idx" ON public."MareReproductiveHistory" USING btree ("tenantId");


--
-- Name: MarketplaceUserBlock_blockedUserId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MarketplaceUserBlock_blockedUserId_idx" ON public."MarketplaceUserBlock" USING btree ("blockedUserId");


--
-- Name: MarketplaceUserBlock_tenantId_blockedUserId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "MarketplaceUserBlock_tenantId_blockedUserId_key" ON public."MarketplaceUserBlock" USING btree ("tenantId", "blockedUserId");


--
-- Name: MarketplaceUserBlock_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MarketplaceUserBlock_tenantId_idx" ON public."MarketplaceUserBlock" USING btree ("tenantId");


--
-- Name: MarketplaceUserBlock_tenantId_liftedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MarketplaceUserBlock_tenantId_liftedAt_idx" ON public."MarketplaceUserBlock" USING btree ("tenantId", "liftedAt");


--
-- Name: MarketplaceUserFlag_activeBlocks_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MarketplaceUserFlag_activeBlocks_idx" ON public."MarketplaceUserFlag" USING btree ("activeBlocks");


--
-- Name: MarketplaceUserFlag_flaggedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MarketplaceUserFlag_flaggedAt_idx" ON public."MarketplaceUserFlag" USING btree ("flaggedAt");


--
-- Name: MarketplaceUserFlag_suspendedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MarketplaceUserFlag_suspendedAt_idx" ON public."MarketplaceUserFlag" USING btree ("suspendedAt");


--
-- Name: MarketplaceUserFlag_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "MarketplaceUserFlag_userId_key" ON public."MarketplaceUserFlag" USING btree ("userId");


--
-- Name: MediaAccessEvent_documentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MediaAccessEvent_documentId_idx" ON public."MediaAccessEvent" USING btree ("documentId");


--
-- Name: MediaAccessEvent_storageKey_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MediaAccessEvent_storageKey_idx" ON public."MediaAccessEvent" USING btree ("storageKey");


--
-- Name: MediaAccessEvent_tenantId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MediaAccessEvent_tenantId_createdAt_idx" ON public."MediaAccessEvent" USING btree ("tenantId", "createdAt");


--
-- Name: Membership_organizationId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Membership_organizationId_idx" ON public."Membership" USING btree ("organizationId");


--
-- Name: MessageParticipant_partyId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MessageParticipant_partyId_idx" ON public."MessageParticipant" USING btree ("partyId");


--
-- Name: MessageParticipant_threadId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MessageParticipant_threadId_idx" ON public."MessageParticipant" USING btree ("threadId");


--
-- Name: MessageParticipant_threadId_partyId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "MessageParticipant_threadId_partyId_key" ON public."MessageParticipant" USING btree ("threadId", "partyId");


--
-- Name: MessageThread_inquiryType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MessageThread_inquiryType_idx" ON public."MessageThread" USING btree ("inquiryType");


--
-- Name: MessageThread_tenantId_archived_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MessageThread_tenantId_archived_idx" ON public."MessageThread" USING btree ("tenantId", archived);


--
-- Name: MessageThread_tenantId_businessHoursResponseTime_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MessageThread_tenantId_businessHoursResponseTime_idx" ON public."MessageThread" USING btree ("tenantId", "businessHoursResponseTime");


--
-- Name: MessageThread_tenantId_flagged_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MessageThread_tenantId_flagged_idx" ON public."MessageThread" USING btree ("tenantId", flagged);


--
-- Name: MessageThread_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MessageThread_tenantId_idx" ON public."MessageThread" USING btree ("tenantId");


--
-- Name: MessageThread_tenantId_responseTimeSeconds_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MessageThread_tenantId_responseTimeSeconds_idx" ON public."MessageThread" USING btree ("tenantId", "responseTimeSeconds");


--
-- Name: MessageThread_tenantId_updatedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MessageThread_tenantId_updatedAt_idx" ON public."MessageThread" USING btree ("tenantId", "updatedAt");


--
-- Name: Message_senderPartyId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Message_senderPartyId_idx" ON public."Message" USING btree ("senderPartyId");


--
-- Name: Message_threadId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Message_threadId_createdAt_idx" ON public."Message" USING btree ("threadId", "createdAt");


--
-- Name: MicrochipRegistry_isActive_sortOrder_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MicrochipRegistry_isActive_sortOrder_idx" ON public."MicrochipRegistry" USING btree ("isActive", "sortOrder");


--
-- Name: MicrochipRegistry_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "MicrochipRegistry_slug_key" ON public."MicrochipRegistry" USING btree (slug);


--
-- Name: MilkingRecord_animalId_milkedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MilkingRecord_animalId_milkedAt_idx" ON public."MilkingRecord" USING btree ("animalId", "milkedAt");


--
-- Name: MilkingRecord_lactationCycleId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MilkingRecord_lactationCycleId_idx" ON public."MilkingRecord" USING btree ("lactationCycleId");


--
-- Name: MilkingRecord_tenantId_animalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MilkingRecord_tenantId_animalId_idx" ON public."MilkingRecord" USING btree ("tenantId", "animalId");


--
-- Name: MilkingRecord_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MilkingRecord_tenantId_idx" ON public."MilkingRecord" USING btree ("tenantId");


--
-- Name: NeonatalCareEntry_offspringId_recordedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "NeonatalCareEntry_offspringId_recordedAt_idx" ON public."NeonatalCareEntry" USING btree ("offspringId", "recordedAt");


--
-- Name: NeonatalCareEntry_tenantId_offspringId_recordedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "NeonatalCareEntry_tenantId_offspringId_recordedAt_idx" ON public."NeonatalCareEntry" USING btree ("tenantId", "offspringId", "recordedAt");


--
-- Name: NeonatalIntervention_offspringId_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "NeonatalIntervention_offspringId_type_idx" ON public."NeonatalIntervention" USING btree ("offspringId", type);


--
-- Name: NeonatalIntervention_tenantId_offspringId_occurredAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "NeonatalIntervention_tenantId_offspringId_occurredAt_idx" ON public."NeonatalIntervention" USING btree ("tenantId", "offspringId", "occurredAt");


--
-- Name: NetworkBreedingInquiry_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "NetworkBreedingInquiry_createdAt_idx" ON public."NetworkBreedingInquiry" USING btree ("createdAt");


--
-- Name: NetworkBreedingInquiry_messageThreadId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "NetworkBreedingInquiry_messageThreadId_key" ON public."NetworkBreedingInquiry" USING btree ("messageThreadId");


--
-- Name: NetworkBreedingInquiry_recipientTenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "NetworkBreedingInquiry_recipientTenantId_status_idx" ON public."NetworkBreedingInquiry" USING btree ("recipientTenantId", status);


--
-- Name: NetworkBreedingInquiry_senderTenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "NetworkBreedingInquiry_senderTenantId_status_idx" ON public."NetworkBreedingInquiry" USING btree ("senderTenantId", status);


--
-- Name: NetworkSearchIndex_species_sex_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "NetworkSearchIndex_species_sex_idx" ON public."NetworkSearchIndex" USING btree (species, sex);


--
-- Name: NetworkSearchIndex_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "NetworkSearchIndex_tenantId_idx" ON public."NetworkSearchIndex" USING btree ("tenantId");


--
-- Name: NetworkSearchIndex_tenantId_species_sex_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "NetworkSearchIndex_tenantId_species_sex_key" ON public."NetworkSearchIndex" USING btree ("tenantId", species, sex);


--
-- Name: Notification_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Notification_createdAt_idx" ON public."Notification" USING btree ("createdAt");


--
-- Name: Notification_idempotencyKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Notification_idempotencyKey_key" ON public."Notification" USING btree ("idempotencyKey");


--
-- Name: Notification_tenantId_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Notification_tenantId_status_createdAt_idx" ON public."Notification" USING btree ("tenantId", status, "createdAt");


--
-- Name: Notification_tenantId_userId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Notification_tenantId_userId_status_idx" ON public."Notification" USING btree ("tenantId", "userId", status);


--
-- Name: Notification_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Notification_type_idx" ON public."Notification" USING btree (type);


--
-- Name: OffspringContract_buyerPartyId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OffspringContract_buyerPartyId_idx" ON public."OffspringContract" USING btree ("buyerPartyId");


--
-- Name: OffspringContract_offspringId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OffspringContract_offspringId_idx" ON public."OffspringContract" USING btree ("offspringId");


--
-- Name: OffspringContract_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OffspringContract_status_idx" ON public."OffspringContract" USING btree (status);


--
-- Name: OffspringContract_tenantId_buyerPartyId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OffspringContract_tenantId_buyerPartyId_idx" ON public."OffspringContract" USING btree ("tenantId", "buyerPartyId");


--
-- Name: OffspringContract_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OffspringContract_tenantId_idx" ON public."OffspringContract" USING btree ("tenantId");


--
-- Name: OffspringDocument_offspringId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OffspringDocument_offspringId_idx" ON public."OffspringDocument" USING btree ("offspringId");


--
-- Name: OffspringDocument_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OffspringDocument_status_idx" ON public."OffspringDocument" USING btree (status);


--
-- Name: OffspringDocument_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OffspringDocument_tenantId_idx" ON public."OffspringDocument" USING btree ("tenantId");


--
-- Name: OffspringEvent_offspringId_type_occurredAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OffspringEvent_offspringId_type_occurredAt_idx" ON public."OffspringEvent" USING btree ("offspringId", type, "occurredAt");


--
-- Name: OffspringEvent_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OffspringEvent_tenantId_idx" ON public."OffspringEvent" USING btree ("tenantId");


--
-- Name: OffspringInvoiceLink_invoiceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OffspringInvoiceLink_invoiceId_idx" ON public."OffspringInvoiceLink" USING btree ("invoiceId");


--
-- Name: OffspringInvoiceLink_offspringId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OffspringInvoiceLink_offspringId_idx" ON public."OffspringInvoiceLink" USING btree ("offspringId");


--
-- Name: OffspringInvoiceLink_offspringId_invoiceId_role_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "OffspringInvoiceLink_offspringId_invoiceId_role_key" ON public."OffspringInvoiceLink" USING btree ("offspringId", "invoiceId", role);


--
-- Name: OffspringInvoiceLink_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OffspringInvoiceLink_tenantId_idx" ON public."OffspringInvoiceLink" USING btree ("tenantId");


--
-- Name: OffspringProtocolException_assignmentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OffspringProtocolException_assignmentId_idx" ON public."OffspringProtocolException" USING btree ("assignmentId");


--
-- Name: OffspringProtocolException_offspringId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OffspringProtocolException_offspringId_idx" ON public."OffspringProtocolException" USING btree ("offspringId");


--
-- Name: OffspringProtocolException_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OffspringProtocolException_tenantId_idx" ON public."OffspringProtocolException" USING btree ("tenantId");


--
-- Name: Offspring_breedingPlanId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Offspring_breedingPlanId_idx" ON public."Offspring" USING btree ("breedingPlanId");


--
-- Name: Offspring_buyerPartyId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Offspring_buyerPartyId_idx" ON public."Offspring" USING btree ("buyerPartyId");


--
-- Name: Offspring_placedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Offspring_placedAt_idx" ON public."Offspring" USING btree ("placedAt");


--
-- Name: Offspring_tenantId_buyerPartyId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Offspring_tenantId_buyerPartyId_idx" ON public."Offspring" USING btree ("tenantId", "buyerPartyId");


--
-- Name: Offspring_tenantId_damId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Offspring_tenantId_damId_idx" ON public."Offspring" USING btree ("tenantId", "damId");


--
-- Name: Offspring_tenantId_financialState_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Offspring_tenantId_financialState_idx" ON public."Offspring" USING btree ("tenantId", "financialState");


--
-- Name: Offspring_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Offspring_tenantId_idx" ON public."Offspring" USING btree ("tenantId");


--
-- Name: Offspring_tenantId_keeperIntent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Offspring_tenantId_keeperIntent_idx" ON public."Offspring" USING btree ("tenantId", "keeperIntent");


--
-- Name: Offspring_tenantId_lifeState_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Offspring_tenantId_lifeState_idx" ON public."Offspring" USING btree ("tenantId", "lifeState");


--
-- Name: Offspring_tenantId_paperworkState_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Offspring_tenantId_paperworkState_idx" ON public."Offspring" USING btree ("tenantId", "paperworkState");


--
-- Name: Offspring_tenantId_placementState_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Offspring_tenantId_placementState_idx" ON public."Offspring" USING btree ("tenantId", "placementState");


--
-- Name: Offspring_tenantId_sireId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Offspring_tenantId_sireId_idx" ON public."Offspring" USING btree ("tenantId", "sireId");


--
-- Name: Offspring_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Offspring_tenantId_status_idx" ON public."Offspring" USING btree ("tenantId", status);


--
-- Name: Organization_archived_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Organization_archived_idx" ON public."Organization" USING btree (archived);


--
-- Name: Organization_id_tenantId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Organization_id_tenantId_key" ON public."Organization" USING btree (id, "tenantId");


--
-- Name: Organization_isPublicProgram_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Organization_isPublicProgram_idx" ON public."Organization" USING btree ("isPublicProgram");


--
-- Name: Organization_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Organization_name_idx" ON public."Organization" USING btree (name);


--
-- Name: Organization_partyId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Organization_partyId_key" ON public."Organization" USING btree ("partyId");


--
-- Name: Organization_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Organization_tenantId_idx" ON public."Organization" USING btree ("tenantId");


--
-- Name: Organization_tenantId_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Organization_tenantId_name_key" ON public."Organization" USING btree ("tenantId", name);


--
-- Name: Organization_tenantId_programSlug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Organization_tenantId_programSlug_key" ON public."Organization" USING btree ("tenantId", "programSlug");


--
-- Name: PartyActivity_partyId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PartyActivity_partyId_createdAt_idx" ON public."PartyActivity" USING btree ("partyId", "createdAt");


--
-- Name: PartyActivity_tenantId_kind_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PartyActivity_tenantId_kind_idx" ON public."PartyActivity" USING btree ("tenantId", kind);


--
-- Name: PartyActivity_tenantId_partyId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PartyActivity_tenantId_partyId_idx" ON public."PartyActivity" USING btree ("tenantId", "partyId");


--
-- Name: PartyCommPreferenceEvent_channel_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PartyCommPreferenceEvent_channel_createdAt_idx" ON public."PartyCommPreferenceEvent" USING btree (channel, "createdAt");


--
-- Name: PartyCommPreferenceEvent_partyId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PartyCommPreferenceEvent_partyId_createdAt_idx" ON public."PartyCommPreferenceEvent" USING btree ("partyId", "createdAt");


--
-- Name: PartyCommPreference_channel_compliance_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PartyCommPreference_channel_compliance_idx" ON public."PartyCommPreference" USING btree (channel, compliance);


--
-- Name: PartyCommPreference_partyId_channel_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PartyCommPreference_partyId_channel_key" ON public."PartyCommPreference" USING btree ("partyId", channel);


--
-- Name: PartyCommPreference_partyId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PartyCommPreference_partyId_idx" ON public."PartyCommPreference" USING btree ("partyId");


--
-- Name: PartyEmail_partyId_sentAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PartyEmail_partyId_sentAt_idx" ON public."PartyEmail" USING btree ("partyId", "sentAt");


--
-- Name: PartyEmail_tenantId_partyId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PartyEmail_tenantId_partyId_idx" ON public."PartyEmail" USING btree ("tenantId", "partyId");


--
-- Name: PartyEvent_partyId_scheduledAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PartyEvent_partyId_scheduledAt_idx" ON public."PartyEvent" USING btree ("partyId", "scheduledAt");


--
-- Name: PartyEvent_tenantId_partyId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PartyEvent_tenantId_partyId_idx" ON public."PartyEvent" USING btree ("tenantId", "partyId");


--
-- Name: PartyEvent_tenantId_status_scheduledAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PartyEvent_tenantId_status_scheduledAt_idx" ON public."PartyEvent" USING btree ("tenantId", status, "scheduledAt");


--
-- Name: PartyMilestone_partyId_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PartyMilestone_partyId_date_idx" ON public."PartyMilestone" USING btree ("partyId", date);


--
-- Name: PartyMilestone_tenantId_annual_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PartyMilestone_tenantId_annual_idx" ON public."PartyMilestone" USING btree ("tenantId", annual);


--
-- Name: PartyMilestone_tenantId_partyId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PartyMilestone_tenantId_partyId_idx" ON public."PartyMilestone" USING btree ("tenantId", "partyId");


--
-- Name: PartyNote_partyId_pinned_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PartyNote_partyId_pinned_idx" ON public."PartyNote" USING btree ("partyId", pinned);


--
-- Name: PartyNote_tenantId_partyId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PartyNote_tenantId_partyId_idx" ON public."PartyNote" USING btree ("tenantId", "partyId");


--
-- Name: Party_tenantId_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Party_tenantId_email_idx" ON public."Party" USING btree ("tenantId", email);


--
-- Name: Party_tenantId_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Party_tenantId_name_idx" ON public."Party" USING btree ("tenantId", name);


--
-- Name: Party_tenantId_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Party_tenantId_type_idx" ON public."Party" USING btree ("tenantId", type);


--
-- Name: PaymentIntent_animalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PaymentIntent_animalId_idx" ON public."PaymentIntent" USING btree ("animalId");


--
-- Name: PaymentIntent_invoiceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PaymentIntent_invoiceId_idx" ON public."PaymentIntent" USING btree ("invoiceId");


--
-- Name: PaymentIntent_ownershipChangeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PaymentIntent_ownershipChangeId_idx" ON public."PaymentIntent" USING btree ("ownershipChangeId");


--
-- Name: PaymentIntent_purpose_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PaymentIntent_purpose_idx" ON public."PaymentIntent" USING btree (purpose);


--
-- Name: PaymentIntent_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PaymentIntent_status_idx" ON public."PaymentIntent" USING btree (status);


--
-- Name: PaymentIntent_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PaymentIntent_tenantId_idx" ON public."PaymentIntent" USING btree ("tenantId");


--
-- Name: PaymentMethod_stripePaymentMethodId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PaymentMethod_stripePaymentMethodId_key" ON public."PaymentMethod" USING btree ("stripePaymentMethodId");


--
-- Name: PaymentMethod_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PaymentMethod_tenantId_idx" ON public."PaymentMethod" USING btree ("tenantId");


--
-- Name: PaymentMethod_tenantId_isDefault_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PaymentMethod_tenantId_isDefault_idx" ON public."PaymentMethod" USING btree ("tenantId", "isDefault");


--
-- Name: Payment_invoiceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Payment_invoiceId_idx" ON public."Payment" USING btree ("invoiceId");


--
-- Name: Payment_invoiceId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Payment_invoiceId_status_idx" ON public."Payment" USING btree ("invoiceId", status);


--
-- Name: Payment_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Payment_status_idx" ON public."Payment" USING btree (status);


--
-- Name: Payment_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Payment_tenantId_idx" ON public."Payment" USING btree ("tenantId");


--
-- Name: Payment_tenantId_invoiceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Payment_tenantId_invoiceId_idx" ON public."Payment" USING btree ("tenantId", "invoiceId");


--
-- Name: Payment_tenantId_receivedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Payment_tenantId_receivedAt_idx" ON public."Payment" USING btree ("tenantId", "receivedAt");


--
-- Name: PlanCodeCounter_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PlanCodeCounter_tenantId_idx" ON public."PlanCodeCounter" USING btree ("tenantId");


--
-- Name: PlanParty_partyId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PlanParty_partyId_idx" ON public."PlanParty" USING btree ("partyId");


--
-- Name: PlanParty_planId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PlanParty_planId_idx" ON public."PlanParty" USING btree ("planId");


--
-- Name: PlanParty_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PlanParty_tenantId_idx" ON public."PlanParty" USING btree ("tenantId");


--
-- Name: PlanParty_tenantId_partyId_role_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PlanParty_tenantId_partyId_role_idx" ON public."PlanParty" USING btree ("tenantId", "partyId", role);


--
-- Name: PlatformSetting_namespace_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PlatformSetting_namespace_key" ON public."PlatformSetting" USING btree (namespace);


--
-- Name: PortalAccess_partyId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PortalAccess_partyId_idx" ON public."PortalAccess" USING btree ("partyId");


--
-- Name: PortalAccess_partyId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PortalAccess_partyId_key" ON public."PortalAccess" USING btree ("partyId");


--
-- Name: PortalAccess_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PortalAccess_status_idx" ON public."PortalAccess" USING btree (status);


--
-- Name: PortalAccess_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PortalAccess_tenantId_idx" ON public."PortalAccess" USING btree ("tenantId");


--
-- Name: PortalAccess_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PortalAccess_userId_idx" ON public."PortalAccess" USING btree ("userId");


--
-- Name: PortalInvite_expiresAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PortalInvite_expiresAt_idx" ON public."PortalInvite" USING btree ("expiresAt");


--
-- Name: PortalInvite_tenantId_emailNorm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PortalInvite_tenantId_emailNorm_idx" ON public."PortalInvite" USING btree ("tenantId", "emailNorm");


--
-- Name: PortalInvite_tenantId_partyId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PortalInvite_tenantId_partyId_idx" ON public."PortalInvite" USING btree ("tenantId", "partyId");


--
-- Name: PortalInvite_tokenHash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PortalInvite_tokenHash_key" ON public."PortalInvite" USING btree ("tokenHash");


--
-- Name: PregnancyCheck_planId_checkedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PregnancyCheck_planId_checkedAt_idx" ON public."PregnancyCheck" USING btree ("planId", "checkedAt");


--
-- Name: PregnancyCheck_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PregnancyCheck_tenantId_idx" ON public."PregnancyCheck" USING btree ("tenantId");


--
-- Name: ProductEntitlement_entitlementKey_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProductEntitlement_entitlementKey_idx" ON public."ProductEntitlement" USING btree ("entitlementKey");


--
-- Name: ProductEntitlement_productId_entitlementKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ProductEntitlement_productId_entitlementKey_key" ON public."ProductEntitlement" USING btree ("productId", "entitlementKey");


--
-- Name: ProductEntitlement_productId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProductEntitlement_productId_idx" ON public."ProductEntitlement" USING btree ("productId");


--
-- Name: Product_active_sortOrder_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Product_active_sortOrder_idx" ON public."Product" USING btree (active, "sortOrder");


--
-- Name: Product_stripeProductId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Product_stripeProductId_key" ON public."Product" USING btree ("stripeProductId");


--
-- Name: Product_type_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Product_type_active_idx" ON public."Product" USING btree (type, active);


--
-- Name: ProtocolComment_parentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProtocolComment_parentId_idx" ON public."ProtocolComment" USING btree ("parentId");


--
-- Name: ProtocolComment_protocolId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProtocolComment_protocolId_createdAt_idx" ON public."ProtocolComment" USING btree ("protocolId", "createdAt");


--
-- Name: ProtocolCopyRecord_protocolId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProtocolCopyRecord_protocolId_idx" ON public."ProtocolCopyRecord" USING btree ("protocolId");


--
-- Name: ProtocolCopyRecord_protocolId_tenantId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ProtocolCopyRecord_protocolId_tenantId_key" ON public."ProtocolCopyRecord" USING btree ("protocolId", "tenantId");


--
-- Name: ProtocolRating_protocolId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProtocolRating_protocolId_idx" ON public."ProtocolRating" USING btree ("protocolId");


--
-- Name: ProtocolRating_protocolId_tenantId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ProtocolRating_protocolId_tenantId_key" ON public."ProtocolRating" USING btree ("protocolId", "tenantId");


--
-- Name: RearingCertificate_assignmentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RearingCertificate_assignmentId_idx" ON public."RearingCertificate" USING btree ("assignmentId");


--
-- Name: RearingCertificate_certificateType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RearingCertificate_certificateType_idx" ON public."RearingCertificate" USING btree ("certificateType");


--
-- Name: RearingCertificate_isValid_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RearingCertificate_isValid_idx" ON public."RearingCertificate" USING btree ("isValid");


--
-- Name: RearingCertificate_offspringId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RearingCertificate_offspringId_idx" ON public."RearingCertificate" USING btree ("offspringId");


--
-- Name: RearingCertificate_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RearingCertificate_tenantId_idx" ON public."RearingCertificate" USING btree ("tenantId");


--
-- Name: RearingProtocolActivity_stageId_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RearingProtocolActivity_stageId_order_idx" ON public."RearingProtocolActivity" USING btree ("stageId", "order");


--
-- Name: RearingProtocolAssignment_animalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RearingProtocolAssignment_animalId_idx" ON public."RearingProtocolAssignment" USING btree ("animalId");


--
-- Name: RearingProtocolAssignment_animalId_protocolId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "RearingProtocolAssignment_animalId_protocolId_key" ON public."RearingProtocolAssignment" USING btree ("animalId", "protocolId");


--
-- Name: RearingProtocolAssignment_breedingPlanId_protocolId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "RearingProtocolAssignment_breedingPlanId_protocolId_key" ON public."RearingProtocolAssignment" USING btree ("breedingPlanId", "protocolId") WHERE ("breedingPlanId" IS NOT NULL);


--
-- Name: RearingProtocolAssignment_handoffToUserId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RearingProtocolAssignment_handoffToUserId_idx" ON public."RearingProtocolAssignment" USING btree ("handoffToUserId");


--
-- Name: RearingProtocolAssignment_offspringId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RearingProtocolAssignment_offspringId_idx" ON public."RearingProtocolAssignment" USING btree ("offspringId");


--
-- Name: RearingProtocolAssignment_offspringId_protocolId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "RearingProtocolAssignment_offspringId_protocolId_key" ON public."RearingProtocolAssignment" USING btree ("offspringId", "protocolId");


--
-- Name: RearingProtocolAssignment_protocolId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RearingProtocolAssignment_protocolId_idx" ON public."RearingProtocolAssignment" USING btree ("protocolId");


--
-- Name: RearingProtocolAssignment_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RearingProtocolAssignment_status_idx" ON public."RearingProtocolAssignment" USING btree (status);


--
-- Name: RearingProtocolAssignment_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RearingProtocolAssignment_tenantId_idx" ON public."RearingProtocolAssignment" USING btree ("tenantId");


--
-- Name: RearingProtocolStage_protocolId_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RearingProtocolStage_protocolId_order_idx" ON public."RearingProtocolStage" USING btree ("protocolId", "order");


--
-- Name: RearingProtocol_deletedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RearingProtocol_deletedAt_idx" ON public."RearingProtocol" USING btree ("deletedAt");


--
-- Name: RearingProtocol_isBenchmark_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RearingProtocol_isBenchmark_idx" ON public."RearingProtocol" USING btree ("isBenchmark");


--
-- Name: RearingProtocol_isPublic_species_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RearingProtocol_isPublic_species_idx" ON public."RearingProtocol" USING btree ("isPublic", species);


--
-- Name: RearingProtocol_species_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RearingProtocol_species_isActive_idx" ON public."RearingProtocol" USING btree (species, "isActive");


--
-- Name: RearingProtocol_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RearingProtocol_tenantId_idx" ON public."RearingProtocol" USING btree ("tenantId");


--
-- Name: RegistryConnection_registryId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RegistryConnection_registryId_idx" ON public."RegistryConnection" USING btree ("registryId");


--
-- Name: RegistryConnection_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RegistryConnection_tenantId_idx" ON public."RegistryConnection" USING btree ("tenantId");


--
-- Name: RegistryConnection_tenantId_registryId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "RegistryConnection_tenantId_registryId_key" ON public."RegistryConnection" USING btree ("tenantId", "registryId");


--
-- Name: RegistryPedigree_animalRegistryIdentifierId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RegistryPedigree_animalRegistryIdentifierId_idx" ON public."RegistryPedigree" USING btree ("animalRegistryIdentifierId");


--
-- Name: RegistryPedigree_animalRegistryIdentifierId_position_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "RegistryPedigree_animalRegistryIdentifierId_position_key" ON public."RegistryPedigree" USING btree ("animalRegistryIdentifierId", "position");


--
-- Name: RegistryPedigree_linkedAnimalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RegistryPedigree_linkedAnimalId_idx" ON public."RegistryPedigree" USING btree ("linkedAnimalId");


--
-- Name: RegistrySyncLog_action_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RegistrySyncLog_action_idx" ON public."RegistrySyncLog" USING btree (action);


--
-- Name: RegistrySyncLog_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RegistrySyncLog_createdAt_idx" ON public."RegistrySyncLog" USING btree ("createdAt");


--
-- Name: RegistrySyncLog_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RegistrySyncLog_tenantId_idx" ON public."RegistrySyncLog" USING btree ("tenantId");


--
-- Name: RegistrySyncLog_tenantId_registryId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RegistrySyncLog_tenantId_registryId_idx" ON public."RegistrySyncLog" USING btree ("tenantId", "registryId");


--
-- Name: RegistryVerification_animalRegistryIdentifierId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "RegistryVerification_animalRegistryIdentifierId_key" ON public."RegistryVerification" USING btree ("animalRegistryIdentifierId");


--
-- Name: RegistryVerification_verified_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RegistryVerification_verified_idx" ON public."RegistryVerification" USING btree (verified);


--
-- Name: Registry_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Registry_code_key" ON public."Registry" USING btree (code);


--
-- Name: ReproductiveCycle_cycleStart_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ReproductiveCycle_cycleStart_idx" ON public."ReproductiveCycle" USING btree ("cycleStart");


--
-- Name: ReproductiveCycle_femaleId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ReproductiveCycle_femaleId_idx" ON public."ReproductiveCycle" USING btree ("femaleId");


--
-- Name: ReproductiveCycle_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ReproductiveCycle_tenantId_idx" ON public."ReproductiveCycle" USING btree ("tenantId");


--
-- Name: SchedulingAvailabilityBlock_breedingPlanId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SchedulingAvailabilityBlock_breedingPlanId_idx" ON public."SchedulingAvailabilityBlock" USING btree ("breedingPlanId");


--
-- Name: SchedulingAvailabilityBlock_templateId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SchedulingAvailabilityBlock_templateId_idx" ON public."SchedulingAvailabilityBlock" USING btree ("templateId");


--
-- Name: SchedulingAvailabilityBlock_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SchedulingAvailabilityBlock_tenantId_idx" ON public."SchedulingAvailabilityBlock" USING btree ("tenantId");


--
-- Name: SchedulingAvailabilityBlock_tenantId_startAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SchedulingAvailabilityBlock_tenantId_startAt_idx" ON public."SchedulingAvailabilityBlock" USING btree ("tenantId", "startAt");


--
-- Name: SchedulingAvailabilityBlock_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SchedulingAvailabilityBlock_tenantId_status_idx" ON public."SchedulingAvailabilityBlock" USING btree ("tenantId", status);


--
-- Name: SchedulingBooking_eventId_partyId_confirmed_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "SchedulingBooking_eventId_partyId_confirmed_unique" ON public."SchedulingBooking" USING btree ("eventId", "partyId") WHERE (status = 'CONFIRMED'::public."SchedulingBookingStatus");


--
-- Name: SchedulingBooking_eventId_partyId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SchedulingBooking_eventId_partyId_idx" ON public."SchedulingBooking" USING btree ("eventId", "partyId");


--
-- Name: SchedulingBooking_partyId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SchedulingBooking_partyId_idx" ON public."SchedulingBooking" USING btree ("partyId");


--
-- Name: SchedulingBooking_slotId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SchedulingBooking_slotId_idx" ON public."SchedulingBooking" USING btree ("slotId");


--
-- Name: SchedulingBooking_slotId_partyId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "SchedulingBooking_slotId_partyId_key" ON public."SchedulingBooking" USING btree ("slotId", "partyId");


--
-- Name: SchedulingBooking_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SchedulingBooking_status_idx" ON public."SchedulingBooking" USING btree (status);


--
-- Name: SchedulingBooking_tenantId_eventId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SchedulingBooking_tenantId_eventId_idx" ON public."SchedulingBooking" USING btree ("tenantId", "eventId");


--
-- Name: SchedulingBooking_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SchedulingBooking_tenantId_idx" ON public."SchedulingBooking" USING btree ("tenantId");


--
-- Name: SchedulingBooking_tenantId_partyId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SchedulingBooking_tenantId_partyId_idx" ON public."SchedulingBooking" USING btree ("tenantId", "partyId");


--
-- Name: SchedulingEventTemplate_offspringId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SchedulingEventTemplate_offspringId_idx" ON public."SchedulingEventTemplate" USING btree ("offspringId");


--
-- Name: SchedulingEventTemplate_tenantId_eventType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SchedulingEventTemplate_tenantId_eventType_idx" ON public."SchedulingEventTemplate" USING btree ("tenantId", "eventType");


--
-- Name: SchedulingEventTemplate_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SchedulingEventTemplate_tenantId_idx" ON public."SchedulingEventTemplate" USING btree ("tenantId");


--
-- Name: SchedulingEventTemplate_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SchedulingEventTemplate_tenantId_status_idx" ON public."SchedulingEventTemplate" USING btree ("tenantId", status);


--
-- Name: SchedulingSlot_blockId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SchedulingSlot_blockId_idx" ON public."SchedulingSlot" USING btree ("blockId");


--
-- Name: SchedulingSlot_blockId_startsAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SchedulingSlot_blockId_startsAt_idx" ON public."SchedulingSlot" USING btree ("blockId", "startsAt");


--
-- Name: SchedulingSlot_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SchedulingSlot_tenantId_idx" ON public."SchedulingSlot" USING btree ("tenantId");


--
-- Name: SchedulingSlot_tenantId_startsAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SchedulingSlot_tenantId_startsAt_idx" ON public."SchedulingSlot" USING btree ("tenantId", "startsAt");


--
-- Name: SchedulingSlot_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SchedulingSlot_tenantId_status_idx" ON public."SchedulingSlot" USING btree ("tenantId", status);


--
-- Name: SemenInventory_tenantId_batchNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "SemenInventory_tenantId_batchNumber_key" ON public."SemenInventory" USING btree ("tenantId", "batchNumber");


--
-- Name: SemenInventory_tenantId_stallionId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SemenInventory_tenantId_stallionId_idx" ON public."SemenInventory" USING btree ("tenantId", "stallionId");


--
-- Name: SemenInventory_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SemenInventory_tenantId_status_idx" ON public."SemenInventory" USING btree ("tenantId", status);


--
-- Name: SemenUsage_breedingAttemptId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "SemenUsage_breedingAttemptId_key" ON public."SemenUsage" USING btree ("breedingAttemptId");


--
-- Name: SemenUsage_tenantId_inventoryId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SemenUsage_tenantId_inventoryId_idx" ON public."SemenUsage" USING btree ("tenantId", "inventoryId");


--
-- Name: SemenUsage_tenantId_usageDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SemenUsage_tenantId_usageDate_idx" ON public."SemenUsage" USING btree ("tenantId", "usageDate");


--
-- Name: Sequence_tenantId_key_year_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Sequence_tenantId_key_year_idx" ON public."Sequence" USING btree ("tenantId", key, year);


--
-- Name: Sequence_tenantId_key_year_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Sequence_tenantId_key_year_key" ON public."Sequence" USING btree ("tenantId", key, year);


--
-- Name: Session_sessionToken_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Session_sessionToken_key" ON public."Session" USING btree ("sessionToken");


--
-- Name: Session_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Session_userId_idx" ON public."Session" USING btree ("userId");


--
-- Name: ShareCode_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ShareCode_code_idx" ON public."ShareCode" USING btree (code);


--
-- Name: ShareCode_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ShareCode_code_key" ON public."ShareCode" USING btree (code);


--
-- Name: ShareCode_expiresAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ShareCode_expiresAt_idx" ON public."ShareCode" USING btree ("expiresAt");


--
-- Name: ShareCode_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ShareCode_tenantId_status_idx" ON public."ShareCode" USING btree ("tenantId", status);


--
-- Name: ShearingRecord_animalId_shearingDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ShearingRecord_animalId_shearingDate_idx" ON public."ShearingRecord" USING btree ("animalId", "shearingDate");


--
-- Name: ShearingRecord_tenantId_animalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ShearingRecord_tenantId_animalId_idx" ON public."ShearingRecord" USING btree ("tenantId", "animalId");


--
-- Name: ShearingRecord_tenantId_grade_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ShearingRecord_tenantId_grade_idx" ON public."ShearingRecord" USING btree ("tenantId", grade);


--
-- Name: ShearingRecord_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ShearingRecord_tenantId_idx" ON public."ShearingRecord" USING btree ("tenantId");


--
-- Name: SignatureEvent_contractId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SignatureEvent_contractId_idx" ON public."SignatureEvent" USING btree ("contractId");


--
-- Name: SignatureEvent_partyId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SignatureEvent_partyId_idx" ON public."SignatureEvent" USING btree ("partyId");


--
-- Name: SignatureEvent_status_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SignatureEvent_status_at_idx" ON public."SignatureEvent" USING btree (status, at);


--
-- Name: SignatureEvent_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SignatureEvent_tenantId_idx" ON public."SignatureEvent" USING btree ("tenantId");


--
-- Name: StudVisibilityRule_inheritsFromId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StudVisibilityRule_inheritsFromId_idx" ON public."StudVisibilityRule" USING btree ("inheritsFromId");


--
-- Name: StudVisibilityRule_level_levelId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StudVisibilityRule_level_levelId_idx" ON public."StudVisibilityRule" USING btree (level, "levelId");


--
-- Name: StudVisibilityRule_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StudVisibilityRule_tenantId_idx" ON public."StudVisibilityRule" USING btree ("tenantId");


--
-- Name: StudVisibilityRule_tenantId_level_levelId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "StudVisibilityRule_tenantId_level_levelId_key" ON public."StudVisibilityRule" USING btree ("tenantId", level, "levelId");


--
-- Name: SubscriptionAddOn_productId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SubscriptionAddOn_productId_idx" ON public."SubscriptionAddOn" USING btree ("productId");


--
-- Name: SubscriptionAddOn_subscriptionId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SubscriptionAddOn_subscriptionId_idx" ON public."SubscriptionAddOn" USING btree ("subscriptionId");


--
-- Name: Subscription_currentPeriodEnd_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Subscription_currentPeriodEnd_idx" ON public."Subscription" USING btree ("currentPeriodEnd");


--
-- Name: Subscription_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Subscription_status_idx" ON public."Subscription" USING btree (status);


--
-- Name: Subscription_stripeCustomerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Subscription_stripeCustomerId_idx" ON public."Subscription" USING btree ("stripeCustomerId");


--
-- Name: Subscription_stripeSubscriptionId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Subscription_stripeSubscriptionId_idx" ON public."Subscription" USING btree ("stripeSubscriptionId");


--
-- Name: Subscription_stripeSubscriptionId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON public."Subscription" USING btree ("stripeSubscriptionId");


--
-- Name: Subscription_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Subscription_tenantId_idx" ON public."Subscription" USING btree ("tenantId");


--
-- Name: SupplementAdministration_administeredAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupplementAdministration_administeredAt_idx" ON public."SupplementAdministration" USING btree ("administeredAt");


--
-- Name: SupplementAdministration_animalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupplementAdministration_animalId_idx" ON public."SupplementAdministration" USING btree ("animalId");


--
-- Name: SupplementAdministration_scheduleId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupplementAdministration_scheduleId_idx" ON public."SupplementAdministration" USING btree ("scheduleId");


--
-- Name: SupplementAdministration_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupplementAdministration_tenantId_idx" ON public."SupplementAdministration" USING btree ("tenantId");


--
-- Name: SupplementProtocol_isBenchmark_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupplementProtocol_isBenchmark_idx" ON public."SupplementProtocol" USING btree ("isBenchmark");


--
-- Name: SupplementProtocol_tenantId_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupplementProtocol_tenantId_active_idx" ON public."SupplementProtocol" USING btree ("tenantId", active);


--
-- Name: SupplementProtocol_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupplementProtocol_tenantId_idx" ON public."SupplementProtocol" USING btree ("tenantId");


--
-- Name: SupplementSchedule_animalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupplementSchedule_animalId_idx" ON public."SupplementSchedule" USING btree ("animalId");


--
-- Name: SupplementSchedule_breedingPlanId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupplementSchedule_breedingPlanId_idx" ON public."SupplementSchedule" USING btree ("breedingPlanId");


--
-- Name: SupplementSchedule_status_calculatedStartDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupplementSchedule_status_calculatedStartDate_idx" ON public."SupplementSchedule" USING btree (status, "calculatedStartDate");


--
-- Name: SupplementSchedule_status_nextDueDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupplementSchedule_status_nextDueDate_idx" ON public."SupplementSchedule" USING btree (status, "nextDueDate");


--
-- Name: SupplementSchedule_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupplementSchedule_tenantId_idx" ON public."SupplementSchedule" USING btree ("tenantId");


--
-- Name: TagAssignment_animalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TagAssignment_animalId_idx" ON public."TagAssignment" USING btree ("animalId");


--
-- Name: TagAssignment_breedingPlanId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TagAssignment_breedingPlanId_idx" ON public."TagAssignment" USING btree ("breedingPlanId");


--
-- Name: TagAssignment_buyerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TagAssignment_buyerId_idx" ON public."TagAssignment" USING btree ("buyerId");


--
-- Name: TagAssignment_dealId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TagAssignment_dealId_idx" ON public."TagAssignment" USING btree ("dealId");


--
-- Name: TagAssignment_draftId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TagAssignment_draftId_idx" ON public."TagAssignment" USING btree ("draftId");


--
-- Name: TagAssignment_messageThreadId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TagAssignment_messageThreadId_idx" ON public."TagAssignment" USING btree ("messageThreadId");


--
-- Name: TagAssignment_offspringId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TagAssignment_offspringId_idx" ON public."TagAssignment" USING btree ("offspringId");


--
-- Name: TagAssignment_tagId_animalId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "TagAssignment_tagId_animalId_key" ON public."TagAssignment" USING btree ("tagId", "animalId");


--
-- Name: TagAssignment_tagId_breedingPlanId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "TagAssignment_tagId_breedingPlanId_key" ON public."TagAssignment" USING btree ("tagId", "breedingPlanId");


--
-- Name: TagAssignment_tagId_buyerId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "TagAssignment_tagId_buyerId_key" ON public."TagAssignment" USING btree ("tagId", "buyerId");


--
-- Name: TagAssignment_tagId_dealId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "TagAssignment_tagId_dealId_key" ON public."TagAssignment" USING btree ("tagId", "dealId");


--
-- Name: TagAssignment_tagId_documentId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "TagAssignment_tagId_documentId_key" ON public."TagAssignment" USING btree ("tagId", "documentId") WHERE ("documentId" IS NOT NULL);


--
-- Name: TagAssignment_tagId_draftId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "TagAssignment_tagId_draftId_key" ON public."TagAssignment" USING btree ("tagId", "draftId");


--
-- Name: TagAssignment_tagId_messageThreadId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "TagAssignment_tagId_messageThreadId_key" ON public."TagAssignment" USING btree ("tagId", "messageThreadId");


--
-- Name: TagAssignment_tagId_offspringId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "TagAssignment_tagId_offspringId_key" ON public."TagAssignment" USING btree ("tagId", "offspringId");


--
-- Name: TagAssignment_tagId_taggedPartyId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TagAssignment_tagId_taggedPartyId_idx" ON public."TagAssignment" USING btree ("tagId", "taggedPartyId");


--
-- Name: TagAssignment_tagId_taggedPartyId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "TagAssignment_tagId_taggedPartyId_key" ON public."TagAssignment" USING btree ("tagId", "taggedPartyId");


--
-- Name: TagAssignment_tagId_waitlistEntryId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "TagAssignment_tagId_waitlistEntryId_key" ON public."TagAssignment" USING btree ("tagId", "waitlistEntryId");


--
-- Name: TagAssignment_taggedPartyId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TagAssignment_taggedPartyId_idx" ON public."TagAssignment" USING btree ("taggedPartyId");


--
-- Name: TagAssignment_waitlistEntryId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TagAssignment_waitlistEntryId_idx" ON public."TagAssignment" USING btree ("waitlistEntryId");


--
-- Name: Tag_tenantId_isArchived_module_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Tag_tenantId_isArchived_module_idx" ON public."Tag" USING btree ("tenantId", "isArchived", module);


--
-- Name: Tag_tenantId_module_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Tag_tenantId_module_idx" ON public."Tag" USING btree ("tenantId", module);


--
-- Name: Tag_tenantId_module_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Tag_tenantId_module_name_key" ON public."Tag" USING btree ("tenantId", module, name);


--
-- Name: Task_scope_groupId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Task_scope_groupId_idx" ON public."Task" USING btree (scope, "groupId");


--
-- Name: Task_scope_offspringId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Task_scope_offspringId_idx" ON public."Task" USING btree (scope, "offspringId");


--
-- Name: Task_status_dueAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Task_status_dueAt_idx" ON public."Task" USING btree (status, "dueAt");


--
-- Name: Task_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Task_tenantId_idx" ON public."Task" USING btree ("tenantId");


--
-- Name: TemplateContent_templateId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TemplateContent_templateId_idx" ON public."TemplateContent" USING btree ("templateId");


--
-- Name: Template_tenantId_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Template_tenantId_category_idx" ON public."Template" USING btree ("tenantId", category);


--
-- Name: Template_tenantId_channel_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Template_tenantId_channel_idx" ON public."Template" USING btree ("tenantId", channel);


--
-- Name: Template_tenantId_key_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Template_tenantId_key_key" ON public."Template" USING btree ("tenantId", key);


--
-- Name: Template_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Template_tenantId_status_idx" ON public."Template" USING btree ("tenantId", status);


--
-- Name: TenantMembership_membershipRole_membershipStatus_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TenantMembership_membershipRole_membershipStatus_idx" ON public."TenantMembership" USING btree ("membershipRole", "membershipStatus");


--
-- Name: TenantMembership_partyId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TenantMembership_partyId_idx" ON public."TenantMembership" USING btree ("partyId");


--
-- Name: TenantMembership_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TenantMembership_tenantId_idx" ON public."TenantMembership" USING btree ("tenantId");


--
-- Name: TenantProgramBreed_tenantId_breedId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "TenantProgramBreed_tenantId_breedId_key" ON public."TenantProgramBreed" USING btree ("tenantId", "breedId");


--
-- Name: TenantProgramBreed_tenantId_customBreedId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "TenantProgramBreed_tenantId_customBreedId_key" ON public."TenantProgramBreed" USING btree ("tenantId", "customBreedId");


--
-- Name: TenantProgramBreed_tenantId_species_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TenantProgramBreed_tenantId_species_idx" ON public."TenantProgramBreed" USING btree ("tenantId", species);


--
-- Name: TenantSetting_namespace_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TenantSetting_namespace_idx" ON public."TenantSetting" USING btree (namespace);


--
-- Name: TenantSetting_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TenantSetting_tenantId_idx" ON public."TenantSetting" USING btree ("tenantId");


--
-- Name: Tenant_inboundEmailSlug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Tenant_inboundEmailSlug_key" ON public."Tenant" USING btree ("inboundEmailSlug");


--
-- Name: Tenant_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Tenant_name_idx" ON public."Tenant" USING btree (name);


--
-- Name: Tenant_quickResponderBadge_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Tenant_quickResponderBadge_idx" ON public."Tenant" USING btree ("quickResponderBadge");


--
-- Name: Tenant_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Tenant_slug_key" ON public."Tenant" USING btree (slug);


--
-- Name: Tenant_stripeConnectAccountId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Tenant_stripeConnectAccountId_key" ON public."Tenant" USING btree ("stripeConnectAccountId");


--
-- Name: TestResult_animalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TestResult_animalId_idx" ON public."TestResult" USING btree ("animalId");


--
-- Name: TestResult_kind_collectedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TestResult_kind_collectedAt_idx" ON public."TestResult" USING btree (kind, "collectedAt");


--
-- Name: TestResult_planId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TestResult_planId_idx" ON public."TestResult" USING btree ("planId");


--
-- Name: TestResult_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TestResult_tenantId_idx" ON public."TestResult" USING btree ("tenantId");


--
-- Name: TitleDefinition_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TitleDefinition_category_idx" ON public."TitleDefinition" USING btree (category);


--
-- Name: TitleDefinition_species_abbreviation_organization_tenantId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "TitleDefinition_species_abbreviation_organization_tenantId_key" ON public."TitleDefinition" USING btree (species, abbreviation, organization, "tenantId");


--
-- Name: TitleDefinition_species_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TitleDefinition_species_idx" ON public."TitleDefinition" USING btree (species);


--
-- Name: TitleDefinition_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TitleDefinition_tenantId_idx" ON public."TitleDefinition" USING btree ("tenantId");


--
-- Name: TosAcceptance_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TosAcceptance_userId_idx" ON public."TosAcceptance" USING btree ("userId");


--
-- Name: TosAcceptance_version_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TosAcceptance_version_idx" ON public."TosAcceptance" USING btree (version);


--
-- Name: TraitDefinition_species_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TraitDefinition_species_idx" ON public."TraitDefinition" USING btree (species);


--
-- Name: TraitDefinition_species_key_tenantId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "TraitDefinition_species_key_tenantId_key" ON public."TraitDefinition" USING btree (species, key, "tenantId");


--
-- Name: TraitDefinition_tenantId_species_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TraitDefinition_tenantId_species_idx" ON public."TraitDefinition" USING btree ("tenantId", species);


--
-- Name: UnlinkedEmail_tenantId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UnlinkedEmail_tenantId_createdAt_idx" ON public."UnlinkedEmail" USING btree ("tenantId", "createdAt");


--
-- Name: UnlinkedEmail_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UnlinkedEmail_tenantId_idx" ON public."UnlinkedEmail" USING btree ("tenantId");


--
-- Name: UnlinkedEmail_tenantId_linkedPartyId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UnlinkedEmail_tenantId_linkedPartyId_idx" ON public."UnlinkedEmail" USING btree ("tenantId", "linkedPartyId");


--
-- Name: UnlinkedEmail_toAddresses_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UnlinkedEmail_toAddresses_idx" ON public."UnlinkedEmail" USING btree ("toAddresses");


--
-- Name: UsageRecord_recordedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UsageRecord_recordedAt_idx" ON public."UsageRecord" USING btree ("recordedAt");


--
-- Name: UsageRecord_tenantId_metricKey_recordedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UsageRecord_tenantId_metricKey_recordedAt_idx" ON public."UsageRecord" USING btree ("tenantId", "metricKey", "recordedAt");


--
-- Name: UsageSnapshot_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UsageSnapshot_tenantId_idx" ON public."UsageSnapshot" USING btree ("tenantId");


--
-- Name: UserEntitlement_key_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UserEntitlement_key_status_idx" ON public."UserEntitlement" USING btree (key, status);


--
-- Name: UserEntitlement_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UserEntitlement_userId_idx" ON public."UserEntitlement" USING btree ("userId");


--
-- Name: UserEntitlement_userId_key_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UserEntitlement_userId_key_key" ON public."UserEntitlement" USING btree ("userId", key);


--
-- Name: UserNotificationPreferences_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UserNotificationPreferences_tenantId_idx" ON public."UserNotificationPreferences" USING btree ("tenantId");


--
-- Name: UserNotificationPreferences_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UserNotificationPreferences_userId_idx" ON public."UserNotificationPreferences" USING btree ("userId");


--
-- Name: UserNotificationPreferences_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UserNotificationPreferences_userId_key" ON public."UserNotificationPreferences" USING btree ("userId");


--
-- Name: User_country_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_country_idx" ON public."User" USING btree (country);


--
-- Name: User_defaultTenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_defaultTenantId_idx" ON public."User" USING btree ("defaultTenantId");


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: User_partyId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_partyId_idx" ON public."User" USING btree ("partyId");


--
-- Name: User_phoneE164_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_phoneE164_idx" ON public."User" USING btree ("phoneE164");


--
-- Name: User_whatsappE164_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_whatsappE164_idx" ON public."User" USING btree ("whatsappE164");


--
-- Name: VaccinationRecord_administeredAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "VaccinationRecord_administeredAt_idx" ON public."VaccinationRecord" USING btree ("administeredAt");


--
-- Name: VaccinationRecord_animalId_protocolKey_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "VaccinationRecord_animalId_protocolKey_idx" ON public."VaccinationRecord" USING btree ("animalId", "protocolKey");


--
-- Name: VaccinationRecord_tenantId_animalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "VaccinationRecord_tenantId_animalId_idx" ON public."VaccinationRecord" USING btree ("tenantId", "animalId");


--
-- Name: VaccinationRecord_tenantId_protocolKey_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "VaccinationRecord_tenantId_protocolKey_idx" ON public."VaccinationRecord" USING btree ("tenantId", "protocolKey");


--
-- Name: VerificationToken_identifier_purpose_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "VerificationToken_identifier_purpose_idx" ON public."VerificationToken" USING btree (identifier, purpose);


--
-- Name: VerificationToken_tokenHash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "VerificationToken_tokenHash_key" ON public."VerificationToken" USING btree ("tokenHash");


--
-- Name: VerificationToken_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "VerificationToken_token_key" ON public."VerificationToken" USING btree (token);


--
-- Name: WaitlistEntry_animalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WaitlistEntry_animalId_idx" ON public."WaitlistEntry" USING btree ("animalId");


--
-- Name: WaitlistEntry_buyerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WaitlistEntry_buyerId_idx" ON public."WaitlistEntry" USING btree ("buyerId");


--
-- Name: WaitlistEntry_clientPartyId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WaitlistEntry_clientPartyId_idx" ON public."WaitlistEntry" USING btree ("clientPartyId");


--
-- Name: WaitlistEntry_damPrefId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WaitlistEntry_damPrefId_idx" ON public."WaitlistEntry" USING btree ("damPrefId");


--
-- Name: WaitlistEntry_litterId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WaitlistEntry_litterId_idx" ON public."WaitlistEntry" USING btree ("litterId");


--
-- Name: WaitlistEntry_offspringId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WaitlistEntry_offspringId_idx" ON public."WaitlistEntry" USING btree ("offspringId");


--
-- Name: WaitlistEntry_planId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WaitlistEntry_planId_idx" ON public."WaitlistEntry" USING btree ("planId");


--
-- Name: WaitlistEntry_programId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WaitlistEntry_programId_idx" ON public."WaitlistEntry" USING btree ("programId");


--
-- Name: WaitlistEntry_sirePrefId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WaitlistEntry_sirePrefId_idx" ON public."WaitlistEntry" USING btree ("sirePrefId");


--
-- Name: WaitlistEntry_tenantId_clientPartyId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WaitlistEntry_tenantId_clientPartyId_idx" ON public."WaitlistEntry" USING btree ("tenantId", "clientPartyId");


--
-- Name: WaitlistEntry_tenantId_depositPaidAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WaitlistEntry_tenantId_depositPaidAt_idx" ON public."WaitlistEntry" USING btree ("tenantId", "depositPaidAt");


--
-- Name: WaitlistEntry_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WaitlistEntry_tenantId_idx" ON public."WaitlistEntry" USING btree ("tenantId");


--
-- Name: WaitlistEntry_tenantId_speciesPref_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WaitlistEntry_tenantId_speciesPref_idx" ON public."WaitlistEntry" USING btree ("tenantId", "speciesPref");


--
-- Name: WatermarkedAsset_expiresAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WatermarkedAsset_expiresAt_idx" ON public."WatermarkedAsset" USING btree ("expiresAt");


--
-- Name: WatermarkedAsset_tenantId_originalKey_settingsHash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "WatermarkedAsset_tenantId_originalKey_settingsHash_key" ON public."WatermarkedAsset" USING btree ("tenantId", "originalKey", "settingsHash");


--
-- Name: animal_loci_allele1_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX animal_loci_allele1_idx ON public.animal_loci USING btree (allele1);


--
-- Name: animal_loci_allele2_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX animal_loci_allele2_idx ON public.animal_loci USING btree (allele2);


--
-- Name: animal_loci_animal_id_category_locus_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX animal_loci_animal_id_category_locus_key ON public.animal_loci USING btree (animal_id, category, locus);


--
-- Name: animal_loci_animal_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX animal_loci_animal_id_idx ON public.animal_loci USING btree (animal_id);


--
-- Name: animal_loci_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX animal_loci_category_idx ON public.animal_loci USING btree (category);


--
-- Name: animal_loci_category_locus_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX animal_loci_category_locus_idx ON public.animal_loci USING btree (category, locus);


--
-- Name: animal_loci_genotype_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX animal_loci_genotype_idx ON public.animal_loci USING btree (genotype);


--
-- Name: animal_loci_locus_allele1_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX animal_loci_locus_allele1_idx ON public.animal_loci USING btree (locus, allele1);


--
-- Name: animal_loci_locus_allele2_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX animal_loci_locus_allele2_idx ON public.animal_loci USING btree (locus, allele2);


--
-- Name: animal_loci_locus_genotype_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX animal_loci_locus_genotype_idx ON public.animal_loci USING btree (locus, genotype);


--
-- Name: animal_loci_locus_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX animal_loci_locus_idx ON public.animal_loci USING btree (locus);


--
-- Name: devices_userId_fcmToken_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "devices_userId_fcmToken_key" ON public.devices USING btree ("userId", "fcmToken");


--
-- Name: devices_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "devices_userId_idx" ON public.devices USING btree ("userId");


--
-- Name: idx_Document_partyId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_Document_partyId" ON public."Document" USING btree ("partyId");


--
-- Name: idx_TagAssignment_documentId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_TagAssignment_documentId" ON public."TagAssignment" USING btree ("documentId");


--
-- Name: idx_ea_tenant_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ea_tenant_created ON public.entity_activity USING btree ("tenantId", "createdAt" DESC);


--
-- Name: idx_ea_tenant_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ea_tenant_entity ON public.entity_activity USING btree ("tenantId", "entityType", "entityId", "createdAt" DESC);


--
-- Name: idx_eal_changed_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eal_changed_by ON public.entity_audit_log USING btree ("changedBy", "createdAt" DESC);


--
-- Name: idx_eal_tenant_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eal_tenant_created ON public.entity_audit_log USING btree ("tenantId", "createdAt" DESC);


--
-- Name: idx_eal_tenant_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eal_tenant_entity ON public.entity_audit_log USING btree ("tenantId", "entityType", "entityId", "createdAt" DESC);


--
-- Name: idx_email_send_log_retry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_send_log_retry ON public."EmailSendLog" USING btree (status, "nextRetryAt") WHERE ((status = 'failed'::public."EmailSendStatus") AND ("nextRetryAt" IS NOT NULL));


--
-- Name: idx_help_article_embedding_module; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_help_article_embedding_module ON public."HelpArticleEmbedding" USING btree (module);


--
-- Name: idx_help_article_embedding_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_help_article_embedding_tags ON public."HelpArticleEmbedding" USING gin (tags);


--
-- Name: idx_help_article_embedding_vector; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_help_article_embedding_vector ON public."HelpArticleEmbedding" USING ivfflat (embedding public.vector_cosine_ops) WITH (lists='20');


--
-- Name: idx_help_query_log_tenantId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_help_query_log_tenantId" ON public."HelpQueryLog" USING btree ("tenantId");


--
-- Name: idx_help_query_log_userId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_help_query_log_userId" ON public."HelpQueryLog" USING btree ("userId");


--
-- Name: idx_help_query_log_user_day; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_help_query_log_user_day ON public."HelpQueryLog" USING btree ("userId", "createdAt");


--
-- Name: mkt_breeding_booking_animal_animalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "mkt_breeding_booking_animal_animalId_idx" ON public.mkt_breeding_booking_animal USING btree ("animalId");


--
-- Name: mkt_breeding_booking_animal_bookingId_animalId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "mkt_breeding_booking_animal_bookingId_animalId_key" ON public.mkt_breeding_booking_animal USING btree ("bookingId", "animalId");


--
-- Name: mkt_breeding_booking_animal_bookingId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "mkt_breeding_booking_animal_bookingId_idx" ON public.mkt_breeding_booking_animal USING btree ("bookingId");


--
-- Name: mkt_listing_animal_program_slug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mkt_listing_animal_program_slug_idx ON public.mkt_listing_animal_program USING btree (slug);


--
-- Name: mkt_listing_animal_program_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX mkt_listing_animal_program_slug_key ON public.mkt_listing_animal_program USING btree (slug);


--
-- Name: mkt_listing_animal_program_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "mkt_listing_animal_program_tenantId_status_idx" ON public.mkt_listing_animal_program USING btree ("tenantId", status);


--
-- Name: mkt_listing_animal_program_tenantId_templateType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "mkt_listing_animal_program_tenantId_templateType_idx" ON public.mkt_listing_animal_program USING btree ("tenantId", "templateType");


--
-- Name: mkt_listing_breeding_booking_intent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mkt_listing_breeding_booking_intent_idx ON public.mkt_listing_breeding_booking USING btree (intent);


--
-- Name: mkt_listing_breeding_booking_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX mkt_listing_breeding_booking_slug_key ON public.mkt_listing_breeding_booking USING btree (slug);


--
-- Name: mkt_listing_breeding_booking_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "mkt_listing_breeding_booking_tenantId_status_idx" ON public.mkt_listing_breeding_booking USING btree ("tenantId", status);


--
-- Name: mkt_listing_breeding_program_species_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mkt_listing_breeding_program_species_idx ON public.mkt_listing_breeding_program USING btree (species);


--
-- Name: mkt_listing_breeding_program_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mkt_listing_breeding_program_status_idx ON public.mkt_listing_breeding_program USING btree (status);


--
-- Name: mkt_listing_breeding_program_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "mkt_listing_breeding_program_tenantId_idx" ON public.mkt_listing_breeding_program USING btree ("tenantId");


--
-- Name: mkt_listing_breeding_program_tenantId_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "mkt_listing_breeding_program_tenantId_slug_key" ON public.mkt_listing_breeding_program USING btree ("tenantId", slug);


--
-- Name: mkt_listing_individual_animal_animalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "mkt_listing_individual_animal_animalId_idx" ON public.mkt_listing_individual_animal USING btree ("animalId");


--
-- Name: mkt_listing_individual_animal_slug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mkt_listing_individual_animal_slug_idx ON public.mkt_listing_individual_animal USING btree (slug);


--
-- Name: mkt_listing_individual_animal_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX mkt_listing_individual_animal_slug_key ON public.mkt_listing_individual_animal USING btree (slug);


--
-- Name: mkt_listing_individual_animal_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mkt_listing_individual_animal_status_idx ON public.mkt_listing_individual_animal USING btree (status);


--
-- Name: mkt_listing_individual_animal_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "mkt_listing_individual_animal_tenantId_status_idx" ON public.mkt_listing_individual_animal USING btree ("tenantId", status);


--
-- Name: mkt_listing_individual_animal_tenantId_templateType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "mkt_listing_individual_animal_tenantId_templateType_idx" ON public.mkt_listing_individual_animal USING btree ("tenantId", "templateType");


--
-- Name: refresh_tokens_tokenHash_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "refresh_tokens_tokenHash_idx" ON public.refresh_tokens USING btree ("tokenHash");


--
-- Name: refresh_tokens_tokenHash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON public.refresh_tokens USING btree ("tokenHash");


--
-- Name: refresh_tokens_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "refresh_tokens_userId_idx" ON public.refresh_tokens USING btree ("userId");


--
-- Name: AnimalGenetics animal_genetics_sync_loci; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER animal_genetics_sync_loci AFTER INSERT OR UPDATE ON public."AnimalGenetics" FOR EACH ROW EXECUTE FUNCTION public.sync_animal_loci_from_genetics();


--
-- Name: invoices invoices_client_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.invoices
    ADD CONSTRAINT invoices_client_id_fkey FOREIGN KEY (client_id) REFERENCES marketplace.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: invoices invoices_provider_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.invoices
    ADD CONSTRAINT invoices_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES marketplace.providers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: invoices invoices_transaction_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.invoices
    ADD CONSTRAINT invoices_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES marketplace.transactions(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: message_threads message_threads_client_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.message_threads
    ADD CONSTRAINT message_threads_client_id_fkey FOREIGN KEY (client_id) REFERENCES marketplace.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: message_threads message_threads_listing_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.message_threads
    ADD CONSTRAINT message_threads_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES marketplace.mkt_listing_breeder_service(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: message_threads message_threads_provider_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.message_threads
    ADD CONSTRAINT message_threads_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES marketplace.providers(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: message_threads message_threads_transaction_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.message_threads
    ADD CONSTRAINT message_threads_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES marketplace.transactions(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: messages messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES marketplace.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: messages messages_thread_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.messages
    ADD CONSTRAINT messages_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES marketplace.message_threads(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: mkt_listing_breeder_service mkt_listing_breeder_service_provider_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.mkt_listing_breeder_service
    ADD CONSTRAINT mkt_listing_breeder_service_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES marketplace.providers(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: mkt_listing_breeder_service mkt_listing_breeder_service_tenant_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.mkt_listing_breeder_service
    ADD CONSTRAINT mkt_listing_breeder_service_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: mobile_refresh_tokens mobile_refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.mobile_refresh_tokens
    ADD CONSTRAINT mobile_refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES marketplace.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: provider_reports provider_reports_provider_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.provider_reports
    ADD CONSTRAINT provider_reports_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES marketplace.providers(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: provider_reports provider_reports_reporter_user_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.provider_reports
    ADD CONSTRAINT provider_reports_reporter_user_id_fkey FOREIGN KEY (reporter_user_id) REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: provider_terms_acceptance provider_terms_acceptance_user_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.provider_terms_acceptance
    ADD CONSTRAINT provider_terms_acceptance_user_id_fkey FOREIGN KEY (user_id) REFERENCES marketplace.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: providers providers_user_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.providers
    ADD CONSTRAINT providers_user_id_fkey FOREIGN KEY (user_id) REFERENCES marketplace.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: reviews reviews_client_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.reviews
    ADD CONSTRAINT reviews_client_id_fkey FOREIGN KEY (client_id) REFERENCES marketplace.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: reviews reviews_provider_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.reviews
    ADD CONSTRAINT reviews_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES marketplace.providers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: reviews reviews_transaction_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.reviews
    ADD CONSTRAINT reviews_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES marketplace.transactions(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: saved_listings saved_listings_bhq_user_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.saved_listings
    ADD CONSTRAINT saved_listings_bhq_user_id_fkey FOREIGN KEY (bhq_user_id) REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: service_tag_assignments service_tag_assignments_listing_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.service_tag_assignments
    ADD CONSTRAINT service_tag_assignments_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES marketplace.mkt_listing_breeder_service(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: service_tag_assignments service_tag_assignments_tag_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.service_tag_assignments
    ADD CONSTRAINT service_tag_assignments_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES marketplace.service_tags(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: transactions transactions_client_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.transactions
    ADD CONSTRAINT transactions_client_id_fkey FOREIGN KEY (client_id) REFERENCES marketplace.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: transactions transactions_listing_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.transactions
    ADD CONSTRAINT transactions_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES marketplace.mkt_listing_breeder_service(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: transactions transactions_provider_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.transactions
    ADD CONSTRAINT transactions_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES marketplace.providers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: verification_requests verification_requests_marketplace_user_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.verification_requests
    ADD CONSTRAINT verification_requests_marketplace_user_id_fkey FOREIGN KEY (marketplace_user_id) REFERENCES marketplace.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: verification_requests verification_requests_provider_id_fkey; Type: FK CONSTRAINT; Schema: marketplace; Owner: -
--

ALTER TABLE ONLY marketplace.verification_requests
    ADD CONSTRAINT verification_requests_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES marketplace.providers(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ActivityCompletion ActivityCompletion_assignmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ActivityCompletion"
    ADD CONSTRAINT "ActivityCompletion_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES public."RearingProtocolAssignment"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ActivityCompletion ActivityCompletion_offspringId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ActivityCompletion"
    ADD CONSTRAINT "ActivityCompletion_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES public."Offspring"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ActivityCompletion ActivityCompletion_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ActivityCompletion"
    ADD CONSTRAINT "ActivityCompletion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AnimalAccessConversation AnimalAccessConversation_animalAccessId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalAccessConversation"
    ADD CONSTRAINT "AnimalAccessConversation_animalAccessId_fkey" FOREIGN KEY ("animalAccessId") REFERENCES public."AnimalAccess"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AnimalAccessConversation AnimalAccessConversation_messageThreadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalAccessConversation"
    ADD CONSTRAINT "AnimalAccessConversation_messageThreadId_fkey" FOREIGN KEY ("messageThreadId") REFERENCES public."MessageThread"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AnimalAccess AnimalAccess_accessorTenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalAccess"
    ADD CONSTRAINT "AnimalAccess_accessorTenantId_fkey" FOREIGN KEY ("accessorTenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AnimalAccess AnimalAccess_animalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalAccess"
    ADD CONSTRAINT "AnimalAccess_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: AnimalAccess AnimalAccess_breedingPlanId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalAccess"
    ADD CONSTRAINT "AnimalAccess_breedingPlanId_fkey" FOREIGN KEY ("breedingPlanId") REFERENCES public."BreedingPlan"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: AnimalAccess AnimalAccess_ownerTenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalAccess"
    ADD CONSTRAINT "AnimalAccess_ownerTenantId_fkey" FOREIGN KEY ("ownerTenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AnimalAccess AnimalAccess_shareCodeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalAccess"
    ADD CONSTRAINT "AnimalAccess_shareCodeId_fkey" FOREIGN KEY ("shareCodeId") REFERENCES public."ShareCode"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: AnimalBreed AnimalBreed_animalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalBreed"
    ADD CONSTRAINT "AnimalBreed_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AnimalBreed AnimalBreed_breedId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalBreed"
    ADD CONSTRAINT "AnimalBreed_breedId_fkey" FOREIGN KEY ("breedId") REFERENCES public."Breed"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AnimalBreedingProfile AnimalBreedingProfile_animalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalBreedingProfile"
    ADD CONSTRAINT "AnimalBreedingProfile_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AnimalBreedingProfile AnimalBreedingProfile_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalBreedingProfile"
    ADD CONSTRAINT "AnimalBreedingProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AnimalGenetics AnimalGenetics_animalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalGenetics"
    ADD CONSTRAINT "AnimalGenetics_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AnimalIdentityLink AnimalIdentityLink_animalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalIdentityLink"
    ADD CONSTRAINT "AnimalIdentityLink_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AnimalIdentityLink AnimalIdentityLink_identityId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalIdentityLink"
    ADD CONSTRAINT "AnimalIdentityLink_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES public."GlobalAnimalIdentity"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AnimalIncompatibility AnimalIncompatibility_incompatibleAnimalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalIncompatibility"
    ADD CONSTRAINT "AnimalIncompatibility_incompatibleAnimalId_fkey" FOREIGN KEY ("incompatibleAnimalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AnimalIncompatibility AnimalIncompatibility_profileId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalIncompatibility"
    ADD CONSTRAINT "AnimalIncompatibility_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES public."AnimalBreedingProfile"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AnimalIncompatibility AnimalIncompatibility_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalIncompatibility"
    ADD CONSTRAINT "AnimalIncompatibility_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AnimalLinkRequest AnimalLinkRequest_requestingTenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalLinkRequest"
    ADD CONSTRAINT "AnimalLinkRequest_requestingTenantId_fkey" FOREIGN KEY ("requestingTenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AnimalLinkRequest AnimalLinkRequest_requestingUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalLinkRequest"
    ADD CONSTRAINT "AnimalLinkRequest_requestingUserId_fkey" FOREIGN KEY ("requestingUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AnimalLinkRequest AnimalLinkRequest_sourceAnimalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalLinkRequest"
    ADD CONSTRAINT "AnimalLinkRequest_sourceAnimalId_fkey" FOREIGN KEY ("sourceAnimalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AnimalLinkRequest AnimalLinkRequest_targetAnimalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalLinkRequest"
    ADD CONSTRAINT "AnimalLinkRequest_targetAnimalId_fkey" FOREIGN KEY ("targetAnimalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: AnimalLinkRequest AnimalLinkRequest_targetTenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalLinkRequest"
    ADD CONSTRAINT "AnimalLinkRequest_targetTenantId_fkey" FOREIGN KEY ("targetTenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: AnimalMicrochipRegistration AnimalMicrochipRegistration_animalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalMicrochipRegistration"
    ADD CONSTRAINT "AnimalMicrochipRegistration_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AnimalMicrochipRegistration AnimalMicrochipRegistration_offspringId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalMicrochipRegistration"
    ADD CONSTRAINT "AnimalMicrochipRegistration_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES public."Offspring"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AnimalMicrochipRegistration AnimalMicrochipRegistration_registeredToContactId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalMicrochipRegistration"
    ADD CONSTRAINT "AnimalMicrochipRegistration_registeredToContactId_fkey" FOREIGN KEY ("registeredToContactId") REFERENCES public."Contact"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: AnimalMicrochipRegistration AnimalMicrochipRegistration_registryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalMicrochipRegistration"
    ADD CONSTRAINT "AnimalMicrochipRegistration_registryId_fkey" FOREIGN KEY ("registryId") REFERENCES public."MicrochipRegistry"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AnimalMicrochipRegistration AnimalMicrochipRegistration_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalMicrochipRegistration"
    ADD CONSTRAINT "AnimalMicrochipRegistration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AnimalOwner AnimalOwner_animalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalOwner"
    ADD CONSTRAINT "AnimalOwner_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AnimalOwner AnimalOwner_partyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalOwner"
    ADD CONSTRAINT "AnimalOwner_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES public."Party"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AnimalOwnershipChange AnimalOwnershipChange_animalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalOwnershipChange"
    ADD CONSTRAINT "AnimalOwnershipChange_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AnimalOwnershipChange AnimalOwnershipChange_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalOwnershipChange"
    ADD CONSTRAINT "AnimalOwnershipChange_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AnimalPrivacySettings AnimalPrivacySettings_animalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalPrivacySettings"
    ADD CONSTRAINT "AnimalPrivacySettings_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AnimalProgramMedia AnimalProgramMedia_programId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalProgramMedia"
    ADD CONSTRAINT "AnimalProgramMedia_programId_fkey" FOREIGN KEY ("programId") REFERENCES public.mkt_listing_animal_program(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AnimalProgramParticipant AnimalProgramParticipant_animalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalProgramParticipant"
    ADD CONSTRAINT "AnimalProgramParticipant_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AnimalProgramParticipant AnimalProgramParticipant_programId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalProgramParticipant"
    ADD CONSTRAINT "AnimalProgramParticipant_programId_fkey" FOREIGN KEY ("programId") REFERENCES public.mkt_listing_animal_program(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AnimalRegistryIdentifier AnimalRegistryIdentifier_animalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalRegistryIdentifier"
    ADD CONSTRAINT "AnimalRegistryIdentifier_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AnimalRegistryIdentifier AnimalRegistryIdentifier_registryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalRegistryIdentifier"
    ADD CONSTRAINT "AnimalRegistryIdentifier_registryId_fkey" FOREIGN KEY ("registryId") REFERENCES public."Registry"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AnimalTitleDocument AnimalTitleDocument_animalTitleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalTitleDocument"
    ADD CONSTRAINT "AnimalTitleDocument_animalTitleId_fkey" FOREIGN KEY ("animalTitleId") REFERENCES public."AnimalTitle"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AnimalTitleDocument AnimalTitleDocument_documentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalTitleDocument"
    ADD CONSTRAINT "AnimalTitleDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES public."Document"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AnimalTitle AnimalTitle_animalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalTitle"
    ADD CONSTRAINT "AnimalTitle_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AnimalTitle AnimalTitle_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalTitle"
    ADD CONSTRAINT "AnimalTitle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AnimalTitle AnimalTitle_titleDefinitionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalTitle"
    ADD CONSTRAINT "AnimalTitle_titleDefinitionId_fkey" FOREIGN KEY ("titleDefinitionId") REFERENCES public."TitleDefinition"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AnimalTraitEntry AnimalTraitEntry_animalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalTraitEntry"
    ADD CONSTRAINT "AnimalTraitEntry_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AnimalTraitEntry AnimalTraitEntry_documentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalTraitEntry"
    ADD CONSTRAINT "AnimalTraitEntry_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES public."Document"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: AnimalTraitEntry AnimalTraitEntry_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalTraitEntry"
    ADD CONSTRAINT "AnimalTraitEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AnimalTraitEntry AnimalTraitEntry_traitDefinitionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalTraitEntry"
    ADD CONSTRAINT "AnimalTraitEntry_traitDefinitionId_fkey" FOREIGN KEY ("traitDefinitionId") REFERENCES public."TraitDefinition"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AnimalTraitValueDocument AnimalTraitValueDocument_animalTraitValueId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalTraitValueDocument"
    ADD CONSTRAINT "AnimalTraitValueDocument_animalTraitValueId_fkey" FOREIGN KEY ("animalTraitValueId") REFERENCES public."AnimalTraitValue"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AnimalTraitValueDocument AnimalTraitValueDocument_documentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalTraitValueDocument"
    ADD CONSTRAINT "AnimalTraitValueDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES public."Document"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AnimalTraitValue AnimalTraitValue_animalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalTraitValue"
    ADD CONSTRAINT "AnimalTraitValue_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AnimalTraitValue AnimalTraitValue_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalTraitValue"
    ADD CONSTRAINT "AnimalTraitValue_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AnimalTraitValue AnimalTraitValue_traitDefinitionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnimalTraitValue"
    ADD CONSTRAINT "AnimalTraitValue_traitDefinitionId_fkey" FOREIGN KEY ("traitDefinitionId") REFERENCES public."TraitDefinition"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Animal Animal_breedingPlanId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Animal"
    ADD CONSTRAINT "Animal_breedingPlanId_fkey" FOREIGN KEY ("breedingPlanId") REFERENCES public."BreedingPlan"(id);


--
-- Name: Animal Animal_buyerPartyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Animal"
    ADD CONSTRAINT "Animal_buyerPartyId_fkey" FOREIGN KEY ("buyerPartyId") REFERENCES public."Party"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Animal Animal_canonicalBreedId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Animal"
    ADD CONSTRAINT "Animal_canonicalBreedId_fkey" FOREIGN KEY ("canonicalBreedId") REFERENCES public."Breed"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Animal Animal_customBreedId_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Animal"
    ADD CONSTRAINT "Animal_customBreedId_tenantId_fkey" FOREIGN KEY ("customBreedId", "tenantId") REFERENCES public."CustomBreed"(id, "tenantId") ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Animal Animal_damId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Animal"
    ADD CONSTRAINT "Animal_damId_fkey" FOREIGN KEY ("damId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Animal Animal_litterId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Animal"
    ADD CONSTRAINT "Animal_litterId_fkey" FOREIGN KEY ("litterId") REFERENCES public."Litter"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Animal Animal_organizationId_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Animal"
    ADD CONSTRAINT "Animal_organizationId_tenantId_fkey" FOREIGN KEY ("organizationId", "tenantId") REFERENCES public."Organization"(id, "tenantId") ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Animal Animal_sireId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Animal"
    ADD CONSTRAINT "Animal_sireId_fkey" FOREIGN KEY ("sireId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Animal Animal_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Animal"
    ADD CONSTRAINT "Animal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AssessmentResult AssessmentResult_assignmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AssessmentResult"
    ADD CONSTRAINT "AssessmentResult_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES public."RearingProtocolAssignment"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AssessmentResult AssessmentResult_offspringId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AssessmentResult"
    ADD CONSTRAINT "AssessmentResult_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES public."Offspring"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AssessmentResult AssessmentResult_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AssessmentResult"
    ADD CONSTRAINT "AssessmentResult_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AssignmentOffspringOverride AssignmentOffspringOverride_assignmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AssignmentOffspringOverride"
    ADD CONSTRAINT "AssignmentOffspringOverride_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES public."RearingProtocolAssignment"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AssignmentOffspringOverride AssignmentOffspringOverride_offspringId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AssignmentOffspringOverride"
    ADD CONSTRAINT "AssignmentOffspringOverride_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES public."Offspring"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Attachment Attachment_animalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Attachment"
    ADD CONSTRAINT "Attachment_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Attachment Attachment_attachmentPartyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Attachment"
    ADD CONSTRAINT "Attachment_attachmentPartyId_fkey" FOREIGN KEY ("attachmentPartyId") REFERENCES public."Party"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Attachment Attachment_createdByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Attachment"
    ADD CONSTRAINT "Attachment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Attachment Attachment_expenseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Attachment"
    ADD CONSTRAINT "Attachment_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES public."Expense"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Attachment Attachment_invoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Attachment"
    ADD CONSTRAINT "Attachment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES public."Invoice"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Attachment Attachment_litterId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Attachment"
    ADD CONSTRAINT "Attachment_litterId_fkey" FOREIGN KEY ("litterId") REFERENCES public."Litter"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Attachment Attachment_offspringId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Attachment"
    ADD CONSTRAINT "Attachment_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES public."Offspring"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Attachment Attachment_paymentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Attachment"
    ADD CONSTRAINT "Attachment_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES public."Payment"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Attachment Attachment_planId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Attachment"
    ADD CONSTRAINT "Attachment_planId_fkey" FOREIGN KEY ("planId") REFERENCES public."BreedingPlan"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Attachment Attachment_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Attachment"
    ADD CONSTRAINT "Attachment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AutoReplyLog AutoReplyLog_partyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AutoReplyLog"
    ADD CONSTRAINT "AutoReplyLog_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES public."Party"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AutoReplyLog AutoReplyLog_ruleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AutoReplyLog"
    ADD CONSTRAINT "AutoReplyLog_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES public."AutoReplyRule"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: AutoReplyLog AutoReplyLog_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AutoReplyLog"
    ADD CONSTRAINT "AutoReplyLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AutoReplyLog AutoReplyLog_threadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AutoReplyLog"
    ADD CONSTRAINT "AutoReplyLog_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES public."MessageThread"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: AutoReplyRule AutoReplyRule_createdByPartyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AutoReplyRule"
    ADD CONSTRAINT "AutoReplyRule_createdByPartyId_fkey" FOREIGN KEY ("createdByPartyId") REFERENCES public."Party"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: AutoReplyRule AutoReplyRule_templateId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AutoReplyRule"
    ADD CONSTRAINT "AutoReplyRule_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES public."Template"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AutoReplyRule AutoReplyRule_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AutoReplyRule"
    ADD CONSTRAINT "AutoReplyRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BillingAccount BillingAccount_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BillingAccount"
    ADD CONSTRAINT "BillingAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BlockedEmail BlockedEmail_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BlockedEmail"
    ADD CONSTRAINT "BlockedEmail_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BreedRegistryLink BreedRegistryLink_breedId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedRegistryLink"
    ADD CONSTRAINT "BreedRegistryLink_breedId_fkey" FOREIGN KEY ("breedId") REFERENCES public."Breed"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BreedRegistryLink BreedRegistryLink_registryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedRegistryLink"
    ADD CONSTRAINT "BreedRegistryLink_registryId_fkey" FOREIGN KEY ("registryId") REFERENCES public."Registry"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BreederProfile BreederProfile_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreederProfile"
    ADD CONSTRAINT "BreederProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BreederReportFlag BreederReportFlag_breederTenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreederReportFlag"
    ADD CONSTRAINT "BreederReportFlag_breederTenantId_fkey" FOREIGN KEY ("breederTenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BreederReport BreederReport_breederTenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreederReport"
    ADD CONSTRAINT "BreederReport_breederTenantId_fkey" FOREIGN KEY ("breederTenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BreederReport BreederReport_reporterUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreederReport"
    ADD CONSTRAINT "BreederReport_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BreederReport BreederReport_reviewedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreederReport"
    ADD CONSTRAINT "BreederReport_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: BreedingAttempt BreedingAttempt_damId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingAttempt"
    ADD CONSTRAINT "BreedingAttempt_damId_fkey" FOREIGN KEY ("damId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: BreedingAttempt BreedingAttempt_planId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingAttempt"
    ADD CONSTRAINT "BreedingAttempt_planId_fkey" FOREIGN KEY ("planId") REFERENCES public."BreedingPlan"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: BreedingAttempt BreedingAttempt_sireId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingAttempt"
    ADD CONSTRAINT "BreedingAttempt_sireId_fkey" FOREIGN KEY ("sireId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: BreedingAttempt BreedingAttempt_studOwnerPartyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingAttempt"
    ADD CONSTRAINT "BreedingAttempt_studOwnerPartyId_fkey" FOREIGN KEY ("studOwnerPartyId") REFERENCES public."Party"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: BreedingAttempt BreedingAttempt_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingAttempt"
    ADD CONSTRAINT "BreedingAttempt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BreedingBooking BreedingBooking_breedingPlanId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingBooking"
    ADD CONSTRAINT "BreedingBooking_breedingPlanId_fkey" FOREIGN KEY ("breedingPlanId") REFERENCES public."BreedingPlan"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: BreedingBooking BreedingBooking_offeringAnimalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingBooking"
    ADD CONSTRAINT "BreedingBooking_offeringAnimalId_fkey" FOREIGN KEY ("offeringAnimalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: BreedingBooking BreedingBooking_offeringTenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingBooking"
    ADD CONSTRAINT "BreedingBooking_offeringTenantId_fkey" FOREIGN KEY ("offeringTenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: BreedingBooking BreedingBooking_seekingAnimalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingBooking"
    ADD CONSTRAINT "BreedingBooking_seekingAnimalId_fkey" FOREIGN KEY ("seekingAnimalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: BreedingBooking BreedingBooking_seekingPartyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingBooking"
    ADD CONSTRAINT "BreedingBooking_seekingPartyId_fkey" FOREIGN KEY ("seekingPartyId") REFERENCES public."Party"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: BreedingBooking BreedingBooking_seekingTenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingBooking"
    ADD CONSTRAINT "BreedingBooking_seekingTenantId_fkey" FOREIGN KEY ("seekingTenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: BreedingBooking BreedingBooking_semenUsageId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingBooking"
    ADD CONSTRAINT "BreedingBooking_semenUsageId_fkey" FOREIGN KEY ("semenUsageId") REFERENCES public."SemenUsage"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: BreedingBooking BreedingBooking_sourceListingId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingBooking"
    ADD CONSTRAINT "BreedingBooking_sourceListingId_fkey" FOREIGN KEY ("sourceListingId") REFERENCES public."BreedingListing"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: BreedingDataAgreement BreedingDataAgreement_animalAccessId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingDataAgreement"
    ADD CONSTRAINT "BreedingDataAgreement_animalAccessId_fkey" FOREIGN KEY ("animalAccessId") REFERENCES public."AnimalAccess"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: BreedingDataAgreement BreedingDataAgreement_approvingTenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingDataAgreement"
    ADD CONSTRAINT "BreedingDataAgreement_approvingTenantId_fkey" FOREIGN KEY ("approvingTenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BreedingDataAgreement BreedingDataAgreement_breedingPlanId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingDataAgreement"
    ADD CONSTRAINT "BreedingDataAgreement_breedingPlanId_fkey" FOREIGN KEY ("breedingPlanId") REFERENCES public."BreedingPlan"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BreedingDataAgreement BreedingDataAgreement_requestingTenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingDataAgreement"
    ADD CONSTRAINT "BreedingDataAgreement_requestingTenantId_fkey" FOREIGN KEY ("requestingTenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BreedingDiscoveryProgram BreedingDiscoveryProgram_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingDiscoveryProgram"
    ADD CONSTRAINT "BreedingDiscoveryProgram_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BreedingEvent BreedingEvent_animalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingEvent"
    ADD CONSTRAINT "BreedingEvent_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BreedingEvent BreedingEvent_breedingPlanId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingEvent"
    ADD CONSTRAINT "BreedingEvent_breedingPlanId_fkey" FOREIGN KEY ("breedingPlanId") REFERENCES public."BreedingPlan"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: BreedingEvent BreedingEvent_partnerAnimalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingEvent"
    ADD CONSTRAINT "BreedingEvent_partnerAnimalId_fkey" FOREIGN KEY ("partnerAnimalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: BreedingEvent BreedingEvent_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingEvent"
    ADD CONSTRAINT "BreedingEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BreedingGroupMember BreedingGroupMember_breedingPlanId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingGroupMember"
    ADD CONSTRAINT "BreedingGroupMember_breedingPlanId_fkey" FOREIGN KEY ("breedingPlanId") REFERENCES public."BreedingPlan"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: BreedingGroupMember BreedingGroupMember_damId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingGroupMember"
    ADD CONSTRAINT "BreedingGroupMember_damId_fkey" FOREIGN KEY ("damId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: BreedingGroupMember BreedingGroupMember_groupId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingGroupMember"
    ADD CONSTRAINT "BreedingGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES public."BreedingGroup"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BreedingGroupMember BreedingGroupMember_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingGroupMember"
    ADD CONSTRAINT "BreedingGroupMember_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BreedingGroup BreedingGroup_organizationId_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingGroup"
    ADD CONSTRAINT "BreedingGroup_organizationId_tenantId_fkey" FOREIGN KEY ("organizationId", "tenantId") REFERENCES public."Organization"(id, "tenantId") ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: BreedingGroup BreedingGroup_programId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingGroup"
    ADD CONSTRAINT "BreedingGroup_programId_fkey" FOREIGN KEY ("programId") REFERENCES public.mkt_listing_breeding_program(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: BreedingGroup BreedingGroup_sireId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingGroup"
    ADD CONSTRAINT "BreedingGroup_sireId_fkey" FOREIGN KEY ("sireId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: BreedingGroup BreedingGroup_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingGroup"
    ADD CONSTRAINT "BreedingGroup_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BreedingInquiry BreedingInquiry_listingId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingInquiry"
    ADD CONSTRAINT "BreedingInquiry_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES public."BreedingListing"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BreedingInquiry BreedingInquiry_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingInquiry"
    ADD CONSTRAINT "BreedingInquiry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BreedingListing BreedingListing_animalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingListing"
    ADD CONSTRAINT "BreedingListing_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: BreedingListing BreedingListing_programId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingListing"
    ADD CONSTRAINT "BreedingListing_programId_fkey" FOREIGN KEY ("programId") REFERENCES public."BreedingDiscoveryProgram"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: BreedingListing BreedingListing_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingListing"
    ADD CONSTRAINT "BreedingListing_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BreedingMilestone BreedingMilestone_breedingPlanId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingMilestone"
    ADD CONSTRAINT "BreedingMilestone_breedingPlanId_fkey" FOREIGN KEY ("breedingPlanId") REFERENCES public."BreedingPlan"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BreedingMilestone BreedingMilestone_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingMilestone"
    ADD CONSTRAINT "BreedingMilestone_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BreedingPlanBuyer BreedingPlanBuyer_buyerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingPlanBuyer"
    ADD CONSTRAINT "BreedingPlanBuyer_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES public."Buyer"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: BreedingPlanBuyer BreedingPlanBuyer_partyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingPlanBuyer"
    ADD CONSTRAINT "BreedingPlanBuyer_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES public."Party"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: BreedingPlanBuyer BreedingPlanBuyer_planId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingPlanBuyer"
    ADD CONSTRAINT "BreedingPlanBuyer_planId_fkey" FOREIGN KEY ("planId") REFERENCES public."BreedingPlan"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BreedingPlanBuyer BreedingPlanBuyer_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingPlanBuyer"
    ADD CONSTRAINT "BreedingPlanBuyer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BreedingPlanBuyer BreedingPlanBuyer_waitlistEntryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingPlanBuyer"
    ADD CONSTRAINT "BreedingPlanBuyer_waitlistEntryId_fkey" FOREIGN KEY ("waitlistEntryId") REFERENCES public."WaitlistEntry"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: BreedingPlanEvent BreedingPlanEvent_planId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingPlanEvent"
    ADD CONSTRAINT "BreedingPlanEvent_planId_fkey" FOREIGN KEY ("planId") REFERENCES public."BreedingPlan"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BreedingPlanEvent BreedingPlanEvent_recordedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingPlanEvent"
    ADD CONSTRAINT "BreedingPlanEvent_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: BreedingPlanEvent BreedingPlanEvent_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingPlanEvent"
    ADD CONSTRAINT "BreedingPlanEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BreedingPlanTempLog BreedingPlanTempLog_planId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingPlanTempLog"
    ADD CONSTRAINT "BreedingPlanTempLog_planId_fkey" FOREIGN KEY ("planId") REFERENCES public."BreedingPlan"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BreedingPlanTempLog BreedingPlanTempLog_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingPlanTempLog"
    ADD CONSTRAINT "BreedingPlanTempLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BreedingPlan BreedingPlan_committedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingPlan"
    ADD CONSTRAINT "BreedingPlan_committedByUserId_fkey" FOREIGN KEY ("committedByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: BreedingPlan BreedingPlan_damId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingPlan"
    ADD CONSTRAINT "BreedingPlan_damId_fkey" FOREIGN KEY ("damId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: BreedingPlan BreedingPlan_organizationId_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingPlan"
    ADD CONSTRAINT "BreedingPlan_organizationId_tenantId_fkey" FOREIGN KEY ("organizationId", "tenantId") REFERENCES public."Organization"(id, "tenantId") ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: BreedingPlan BreedingPlan_ovulationTestResultId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingPlan"
    ADD CONSTRAINT "BreedingPlan_ovulationTestResultId_fkey" FOREIGN KEY ("ovulationTestResultId") REFERENCES public."TestResult"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: BreedingPlan BreedingPlan_programId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingPlan"
    ADD CONSTRAINT "BreedingPlan_programId_fkey" FOREIGN KEY ("programId") REFERENCES public.mkt_listing_breeding_program(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: BreedingPlan BreedingPlan_sireId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingPlan"
    ADD CONSTRAINT "BreedingPlan_sireId_fkey" FOREIGN KEY ("sireId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: BreedingPlan BreedingPlan_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingPlan"
    ADD CONSTRAINT "BreedingPlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BreedingProgramInquiry BreedingProgramInquiry_assignedToUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingProgramInquiry"
    ADD CONSTRAINT "BreedingProgramInquiry_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: BreedingProgramInquiry BreedingProgramInquiry_programId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingProgramInquiry"
    ADD CONSTRAINT "BreedingProgramInquiry_programId_fkey" FOREIGN KEY ("programId") REFERENCES public.mkt_listing_breeding_program(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BreedingProgramInquiry BreedingProgramInquiry_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingProgramInquiry"
    ADD CONSTRAINT "BreedingProgramInquiry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BreedingProgramMedia BreedingProgramMedia_programId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingProgramMedia"
    ADD CONSTRAINT "BreedingProgramMedia_programId_fkey" FOREIGN KEY ("programId") REFERENCES public.mkt_listing_breeding_program(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BreedingProgramMedia BreedingProgramMedia_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingProgramMedia"
    ADD CONSTRAINT "BreedingProgramMedia_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BreedingProgramRuleExecution BreedingProgramRuleExecution_ruleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingProgramRuleExecution"
    ADD CONSTRAINT "BreedingProgramRuleExecution_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES public."BreedingProgramRule"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BreedingProgramRule BreedingProgramRule_inheritsFromId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingProgramRule"
    ADD CONSTRAINT "BreedingProgramRule_inheritsFromId_fkey" FOREIGN KEY ("inheritsFromId") REFERENCES public."BreedingProgramRule"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: BreedingProgramRule BreedingProgramRule_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BreedingProgramRule"
    ADD CONSTRAINT "BreedingProgramRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BuyerEmailTemplate BuyerEmailTemplate_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BuyerEmailTemplate"
    ADD CONSTRAINT "BuyerEmailTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BuyerInterest BuyerInterest_animalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BuyerInterest"
    ADD CONSTRAINT "BuyerInterest_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BuyerInterest BuyerInterest_buyerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BuyerInterest"
    ADD CONSTRAINT "BuyerInterest_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES public."Buyer"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BuyerTask BuyerTask_animalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BuyerTask"
    ADD CONSTRAINT "BuyerTask_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: BuyerTask BuyerTask_assignedToUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BuyerTask"
    ADD CONSTRAINT "BuyerTask_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: BuyerTask BuyerTask_buyerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BuyerTask"
    ADD CONSTRAINT "BuyerTask_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES public."Buyer"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BuyerTask BuyerTask_completedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BuyerTask"
    ADD CONSTRAINT "BuyerTask_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: BuyerTask BuyerTask_dealId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BuyerTask"
    ADD CONSTRAINT "BuyerTask_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES public."Deal"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BuyerTask BuyerTask_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BuyerTask"
    ADD CONSTRAINT "BuyerTask_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Buyer Buyer_partyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Buyer"
    ADD CONSTRAINT "Buyer_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES public."Party"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Buyer Buyer_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Buyer"
    ADD CONSTRAINT "Buyer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CampaignAttribution CampaignAttribution_campaignId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CampaignAttribution"
    ADD CONSTRAINT "CampaignAttribution_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES public."Campaign"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CampaignAttribution CampaignAttribution_offspringId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CampaignAttribution"
    ADD CONSTRAINT "CampaignAttribution_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES public."Offspring"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: CampaignAttribution CampaignAttribution_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CampaignAttribution"
    ADD CONSTRAINT "CampaignAttribution_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Campaign Campaign_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Campaign"
    ADD CONSTRAINT "Campaign_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CompetitionEntryDocument CompetitionEntryDocument_competitionEntryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CompetitionEntryDocument"
    ADD CONSTRAINT "CompetitionEntryDocument_competitionEntryId_fkey" FOREIGN KEY ("competitionEntryId") REFERENCES public."CompetitionEntry"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CompetitionEntryDocument CompetitionEntryDocument_documentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CompetitionEntryDocument"
    ADD CONSTRAINT "CompetitionEntryDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES public."Document"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CompetitionEntry CompetitionEntry_animalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CompetitionEntry"
    ADD CONSTRAINT "CompetitionEntry_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CompetitionEntry CompetitionEntry_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CompetitionEntry"
    ADD CONSTRAINT "CompetitionEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ContactChangeRequest ContactChangeRequest_contactId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ContactChangeRequest"
    ADD CONSTRAINT "ContactChangeRequest_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES public."Contact"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ContactChangeRequest ContactChangeRequest_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ContactChangeRequest"
    ADD CONSTRAINT "ContactChangeRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Contact Contact_organizationId_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Contact"
    ADD CONSTRAINT "Contact_organizationId_tenantId_fkey" FOREIGN KEY ("organizationId", "tenantId") REFERENCES public."Organization"(id, "tenantId") ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Contact Contact_partyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Contact"
    ADD CONSTRAINT "Contact_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES public."Party"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Contact Contact_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Contact"
    ADD CONSTRAINT "Contact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ContractContent ContractContent_contractId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ContractContent"
    ADD CONSTRAINT "ContractContent_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES public."Contract"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ContractParty ContractParty_contractId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ContractParty"
    ADD CONSTRAINT "ContractParty_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES public."Contract"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ContractParty ContractParty_partyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ContractParty"
    ADD CONSTRAINT "ContractParty_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES public."Party"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ContractParty ContractParty_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ContractParty"
    ADD CONSTRAINT "ContractParty_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ContractParty ContractParty_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ContractParty"
    ADD CONSTRAINT "ContractParty_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ContractTemplate ContractTemplate_createdByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ContractTemplate"
    ADD CONSTRAINT "ContractTemplate_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ContractTemplate ContractTemplate_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ContractTemplate"
    ADD CONSTRAINT "ContractTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Contract Contract_animalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Contract"
    ADD CONSTRAINT "Contract_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Contract Contract_breedingPlanId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Contract"
    ADD CONSTRAINT "Contract_breedingPlanId_fkey" FOREIGN KEY ("breedingPlanId") REFERENCES public."BreedingPlan"(id);


--
-- Name: Contract Contract_invoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Contract"
    ADD CONSTRAINT "Contract_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES public."Invoice"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Contract Contract_offspringId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Contract"
    ADD CONSTRAINT "Contract_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES public."Offspring"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Contract Contract_templateId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Contract"
    ADD CONSTRAINT "Contract_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES public."ContractTemplate"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Contract Contract_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Contract"
    ADD CONSTRAINT "Contract_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Contract Contract_waitlistEntryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Contract"
    ADD CONSTRAINT "Contract_waitlistEntryId_fkey" FOREIGN KEY ("waitlistEntryId") REFERENCES public."WaitlistEntry"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: CrossTenantAnimalLink CrossTenantAnimalLink_childAnimalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CrossTenantAnimalLink"
    ADD CONSTRAINT "CrossTenantAnimalLink_childAnimalId_fkey" FOREIGN KEY ("childAnimalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CrossTenantAnimalLink CrossTenantAnimalLink_childTenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CrossTenantAnimalLink"
    ADD CONSTRAINT "CrossTenantAnimalLink_childTenantId_fkey" FOREIGN KEY ("childTenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CrossTenantAnimalLink CrossTenantAnimalLink_linkRequestId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CrossTenantAnimalLink"
    ADD CONSTRAINT "CrossTenantAnimalLink_linkRequestId_fkey" FOREIGN KEY ("linkRequestId") REFERENCES public."AnimalLinkRequest"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: CrossTenantAnimalLink CrossTenantAnimalLink_parentAnimalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CrossTenantAnimalLink"
    ADD CONSTRAINT "CrossTenantAnimalLink_parentAnimalId_fkey" FOREIGN KEY ("parentAnimalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CrossTenantAnimalLink CrossTenantAnimalLink_parentTenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CrossTenantAnimalLink"
    ADD CONSTRAINT "CrossTenantAnimalLink_parentTenantId_fkey" FOREIGN KEY ("parentTenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CustomBreed CustomBreed_createdByOrganizationId_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CustomBreed"
    ADD CONSTRAINT "CustomBreed_createdByOrganizationId_tenantId_fkey" FOREIGN KEY ("createdByOrganizationId", "tenantId") REFERENCES public."Organization"(id, "tenantId") ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CustomBreed CustomBreed_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CustomBreed"
    ADD CONSTRAINT "CustomBreed_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DHIATestRecord DHIATestRecord_animalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DHIATestRecord"
    ADD CONSTRAINT "DHIATestRecord_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DHIATestRecord DHIATestRecord_lactationCycleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DHIATestRecord"
    ADD CONSTRAINT "DHIATestRecord_lactationCycleId_fkey" FOREIGN KEY ("lactationCycleId") REFERENCES public."LactationCycle"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: DHIATestRecord DHIATestRecord_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DHIATestRecord"
    ADD CONSTRAINT "DHIATestRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DairyProductionHistory DairyProductionHistory_animalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DairyProductionHistory"
    ADD CONSTRAINT "DairyProductionHistory_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DairyProductionHistory DairyProductionHistory_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DairyProductionHistory"
    ADD CONSTRAINT "DairyProductionHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DealActivity DealActivity_dealId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DealActivity"
    ADD CONSTRAINT "DealActivity_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES public."Deal"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DealActivity DealActivity_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DealActivity"
    ADD CONSTRAINT "DealActivity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DealActivity DealActivity_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DealActivity"
    ADD CONSTRAINT "DealActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Deal Deal_animalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Deal"
    ADD CONSTRAINT "Deal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Deal Deal_buyerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Deal"
    ADD CONSTRAINT "Deal_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES public."Buyer"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Deal Deal_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Deal"
    ADD CONSTRAINT "Deal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DocumentBundleItem DocumentBundleItem_bundleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DocumentBundleItem"
    ADD CONSTRAINT "DocumentBundleItem_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES public."DocumentBundle"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DocumentBundleItem DocumentBundleItem_documentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DocumentBundleItem"
    ADD CONSTRAINT "DocumentBundleItem_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES public."Document"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DocumentBundle DocumentBundle_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DocumentBundle"
    ADD CONSTRAINT "DocumentBundle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Document Document_animalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Document"
    ADD CONSTRAINT "Document_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Document Document_breedingPlanId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Document"
    ADD CONSTRAINT "Document_breedingPlanId_fkey" FOREIGN KEY ("breedingPlanId") REFERENCES public."BreedingPlan"(id);


--
-- Name: Document Document_contractId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Document"
    ADD CONSTRAINT "Document_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES public."Contract"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Document Document_invoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Document"
    ADD CONSTRAINT "Document_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES public."Invoice"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Document Document_offspringId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Document"
    ADD CONSTRAINT "Document_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES public."Offspring"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Document Document_ownershipChangeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Document"
    ADD CONSTRAINT "Document_ownershipChangeId_fkey" FOREIGN KEY ("ownershipChangeId") REFERENCES public."AnimalOwnershipChange"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Document Document_partyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Document"
    ADD CONSTRAINT "Document_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES public."Party"(id) ON DELETE SET NULL;


--
-- Name: Document Document_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Document"
    ADD CONSTRAINT "Document_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Draft Draft_createdByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Draft"
    ADD CONSTRAINT "Draft_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Draft Draft_partyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Draft"
    ADD CONSTRAINT "Draft_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES public."Party"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Draft Draft_templateId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Draft"
    ADD CONSTRAINT "Draft_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES public."Template"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Draft Draft_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Draft"
    ADD CONSTRAINT "Draft_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: EmailChangeRequest EmailChangeRequest_contactId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EmailChangeRequest"
    ADD CONSTRAINT "EmailChangeRequest_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES public."Contact"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: EmailChangeRequest EmailChangeRequest_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EmailChangeRequest"
    ADD CONSTRAINT "EmailChangeRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: EmailFilter EmailFilter_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EmailFilter"
    ADD CONSTRAINT "EmailFilter_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: EmailSendLog EmailSendLog_partyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EmailSendLog"
    ADD CONSTRAINT "EmailSendLog_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES public."Party"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: EmailSendLog EmailSendLog_relatedInvoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EmailSendLog"
    ADD CONSTRAINT "EmailSendLog_relatedInvoiceId_fkey" FOREIGN KEY ("relatedInvoiceId") REFERENCES public."Invoice"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: EmailSendLog EmailSendLog_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EmailSendLog"
    ADD CONSTRAINT "EmailSendLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Expense Expense_animalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Expense"
    ADD CONSTRAINT "Expense_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Expense Expense_breedingPlanId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Expense"
    ADD CONSTRAINT "Expense_breedingPlanId_fkey" FOREIGN KEY ("breedingPlanId") REFERENCES public."BreedingPlan"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Expense Expense_foodProductId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Expense"
    ADD CONSTRAINT "Expense_foodProductId_fkey" FOREIGN KEY ("foodProductId") REFERENCES public."FoodProduct"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Expense Expense_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Expense"
    ADD CONSTRAINT "Expense_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Expense Expense_vendorPartyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Expense"
    ADD CONSTRAINT "Expense_vendorPartyId_fkey" FOREIGN KEY ("vendorPartyId") REFERENCES public."Party"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: FeatureCheck FeatureCheck_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FeatureCheck"
    ADD CONSTRAINT "FeatureCheck_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: FeedingPlan FeedingPlan_animalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FeedingPlan"
    ADD CONSTRAINT "FeedingPlan_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: FeedingPlan FeedingPlan_breedingPlanId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FeedingPlan"
    ADD CONSTRAINT "FeedingPlan_breedingPlanId_fkey" FOREIGN KEY ("breedingPlanId") REFERENCES public."BreedingPlan"(id) ON DELETE CASCADE;


--
-- Name: FeedingPlan FeedingPlan_foodProductId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FeedingPlan"
    ADD CONSTRAINT "FeedingPlan_foodProductId_fkey" FOREIGN KEY ("foodProductId") REFERENCES public."FoodProduct"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: FeedingPlan FeedingPlan_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FeedingPlan"
    ADD CONSTRAINT "FeedingPlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: FeedingRecord FeedingRecord_animalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FeedingRecord"
    ADD CONSTRAINT "FeedingRecord_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: FeedingRecord FeedingRecord_breedingPlanId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FeedingRecord"
    ADD CONSTRAINT "FeedingRecord_breedingPlanId_fkey" FOREIGN KEY ("breedingPlanId") REFERENCES public."BreedingPlan"(id) ON DELETE CASCADE;


--
-- Name: FeedingRecord FeedingRecord_feedingPlanId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FeedingRecord"
    ADD CONSTRAINT "FeedingRecord_feedingPlanId_fkey" FOREIGN KEY ("feedingPlanId") REFERENCES public."FeedingPlan"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: FeedingRecord FeedingRecord_foodProductId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FeedingRecord"
    ADD CONSTRAINT "FeedingRecord_foodProductId_fkey" FOREIGN KEY ("foodProductId") REFERENCES public."FoodProduct"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: FeedingRecord FeedingRecord_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FeedingRecord"
    ADD CONSTRAINT "FeedingRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: FiberLabTest FiberLabTest_animalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FiberLabTest"
    ADD CONSTRAINT "FiberLabTest_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: FiberLabTest FiberLabTest_shearingRecordId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FiberLabTest"
    ADD CONSTRAINT "FiberLabTest_shearingRecordId_fkey" FOREIGN KEY ("shearingRecordId") REFERENCES public."ShearingRecord"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: FiberLabTest FiberLabTest_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FiberLabTest"
    ADD CONSTRAINT "FiberLabTest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: FiberProductionHistory FiberProductionHistory_animalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FiberProductionHistory"
    ADD CONSTRAINT "FiberProductionHistory_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: FiberProductionHistory FiberProductionHistory_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FiberProductionHistory"
    ADD CONSTRAINT "FiberProductionHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: FoalingCheck FoalingCheck_breedingPlanId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FoalingCheck"
    ADD CONSTRAINT "FoalingCheck_breedingPlanId_fkey" FOREIGN KEY ("breedingPlanId") REFERENCES public."BreedingPlan"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: FoalingCheck FoalingCheck_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FoalingCheck"
    ADD CONSTRAINT "FoalingCheck_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: FoalingOutcome FoalingOutcome_breedingPlanId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FoalingOutcome"
    ADD CONSTRAINT "FoalingOutcome_breedingPlanId_fkey" FOREIGN KEY ("breedingPlanId") REFERENCES public."BreedingPlan"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: FoalingOutcome FoalingOutcome_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FoalingOutcome"
    ADD CONSTRAINT "FoalingOutcome_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: FoodChange FoodChange_animalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FoodChange"
    ADD CONSTRAINT "FoodChange_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: FoodChange FoodChange_breedingPlanId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FoodChange"
    ADD CONSTRAINT "FoodChange_breedingPlanId_fkey" FOREIGN KEY ("breedingPlanId") REFERENCES public."BreedingPlan"(id) ON DELETE CASCADE;


--
-- Name: FoodChange FoodChange_newPlanId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FoodChange"
    ADD CONSTRAINT "FoodChange_newPlanId_fkey" FOREIGN KEY ("newPlanId") REFERENCES public."FeedingPlan"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: FoodChange FoodChange_previousPlanId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FoodChange"
    ADD CONSTRAINT "FoodChange_previousPlanId_fkey" FOREIGN KEY ("previousPlanId") REFERENCES public."FeedingPlan"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: FoodChange FoodChange_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FoodChange"
    ADD CONSTRAINT "FoodChange_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: FoodProduct FoodProduct_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FoodProduct"
    ADD CONSTRAINT "FoodProduct_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: GeneticNotificationPreference GeneticNotificationPreference_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GeneticNotificationPreference"
    ADD CONSTRAINT "GeneticNotificationPreference_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: GeneticNotificationPreference GeneticNotificationPreference_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GeneticNotificationPreference"
    ADD CONSTRAINT "GeneticNotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: GeneticNotificationSnooze GeneticNotificationSnooze_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GeneticNotificationSnooze"
    ADD CONSTRAINT "GeneticNotificationSnooze_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: GeneticNotificationSnooze GeneticNotificationSnooze_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GeneticNotificationSnooze"
    ADD CONSTRAINT "GeneticNotificationSnooze_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: GeneticsDisclaimerAcceptance GeneticsDisclaimerAcceptance_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GeneticsDisclaimerAcceptance"
    ADD CONSTRAINT "GeneticsDisclaimerAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: GlobalAnimalIdentifier GlobalAnimalIdentifier_identityId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GlobalAnimalIdentifier"
    ADD CONSTRAINT "GlobalAnimalIdentifier_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES public."GlobalAnimalIdentity"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: GlobalAnimalIdentifier GlobalAnimalIdentifier_sourceTenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GlobalAnimalIdentifier"
    ADD CONSTRAINT "GlobalAnimalIdentifier_sourceTenantId_fkey" FOREIGN KEY ("sourceTenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: GlobalAnimalIdentity GlobalAnimalIdentity_damId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GlobalAnimalIdentity"
    ADD CONSTRAINT "GlobalAnimalIdentity_damId_fkey" FOREIGN KEY ("damId") REFERENCES public."GlobalAnimalIdentity"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: GlobalAnimalIdentity GlobalAnimalIdentity_sireId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GlobalAnimalIdentity"
    ADD CONSTRAINT "GlobalAnimalIdentity_sireId_fkey" FOREIGN KEY ("sireId") REFERENCES public."GlobalAnimalIdentity"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: HealthEvent HealthEvent_offspringId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."HealthEvent"
    ADD CONSTRAINT "HealthEvent_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES public."Offspring"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: HealthEvent HealthEvent_recordedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."HealthEvent"
    ADD CONSTRAINT "HealthEvent_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: HealthEvent HealthEvent_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."HealthEvent"
    ADD CONSTRAINT "HealthEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: HelpQueryLog HelpQueryLog_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."HelpQueryLog"
    ADD CONSTRAINT "HelpQueryLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON DELETE CASCADE;


--
-- Name: IdempotencyKey IdempotencyKey_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."IdempotencyKey"
    ADD CONSTRAINT "IdempotencyKey_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: InvoiceLineItem InvoiceLineItem_invoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InvoiceLineItem"
    ADD CONSTRAINT "InvoiceLineItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES public."Invoice"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: InvoiceLineItem InvoiceLineItem_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InvoiceLineItem"
    ADD CONSTRAINT "InvoiceLineItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Invoice Invoice_animalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Invoice Invoice_breedingPlanBuyerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_breedingPlanBuyerId_fkey" FOREIGN KEY ("breedingPlanBuyerId") REFERENCES public."BreedingPlanBuyer"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Invoice Invoice_breedingPlanId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_breedingPlanId_fkey" FOREIGN KEY ("breedingPlanId") REFERENCES public."BreedingPlan"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Invoice Invoice_clientPartyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_clientPartyId_fkey" FOREIGN KEY ("clientPartyId") REFERENCES public."Party"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Invoice Invoice_offspringId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES public."Offspring"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Invoice Invoice_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Invoice Invoice_waitlistEntryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_waitlistEntryId_fkey" FOREIGN KEY ("waitlistEntryId") REFERENCES public."WaitlistEntry"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: LactationCycle LactationCycle_animalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LactationCycle"
    ADD CONSTRAINT "LactationCycle_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: LactationCycle LactationCycle_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LactationCycle"
    ADD CONSTRAINT "LactationCycle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: LinearAppraisal LinearAppraisal_animalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LinearAppraisal"
    ADD CONSTRAINT "LinearAppraisal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: LinearAppraisal LinearAppraisal_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LinearAppraisal"
    ADD CONSTRAINT "LinearAppraisal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: LitterEvent LitterEvent_breedingPlanId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LitterEvent"
    ADD CONSTRAINT "LitterEvent_breedingPlanId_fkey" FOREIGN KEY ("breedingPlanId") REFERENCES public."BreedingPlan"(id);


--
-- Name: LitterEvent LitterEvent_litterId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LitterEvent"
    ADD CONSTRAINT "LitterEvent_litterId_fkey" FOREIGN KEY ("litterId") REFERENCES public."Litter"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: LitterEvent LitterEvent_recordedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LitterEvent"
    ADD CONSTRAINT "LitterEvent_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: LitterEvent LitterEvent_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LitterEvent"
    ADD CONSTRAINT "LitterEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Litter Litter_planId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Litter"
    ADD CONSTRAINT "Litter_planId_fkey" FOREIGN KEY ("planId") REFERENCES public."BreedingPlan"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Litter Litter_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Litter"
    ADD CONSTRAINT "Litter_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MareReproductiveHistory MareReproductiveHistory_mareId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MareReproductiveHistory"
    ADD CONSTRAINT "MareReproductiveHistory_mareId_fkey" FOREIGN KEY ("mareId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MareReproductiveHistory MareReproductiveHistory_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MareReproductiveHistory"
    ADD CONSTRAINT "MareReproductiveHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MarketplaceUserBlock MarketplaceUserBlock_blockedByPartyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MarketplaceUserBlock"
    ADD CONSTRAINT "MarketplaceUserBlock_blockedByPartyId_fkey" FOREIGN KEY ("blockedByPartyId") REFERENCES public."Party"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MarketplaceUserBlock MarketplaceUserBlock_blockedUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MarketplaceUserBlock"
    ADD CONSTRAINT "MarketplaceUserBlock_blockedUserId_fkey" FOREIGN KEY ("blockedUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MarketplaceUserBlock MarketplaceUserBlock_liftedByPartyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MarketplaceUserBlock"
    ADD CONSTRAINT "MarketplaceUserBlock_liftedByPartyId_fkey" FOREIGN KEY ("liftedByPartyId") REFERENCES public."Party"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MarketplaceUserBlock MarketplaceUserBlock_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MarketplaceUserBlock"
    ADD CONSTRAINT "MarketplaceUserBlock_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MarketplaceUserFlag MarketplaceUserFlag_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MarketplaceUserFlag"
    ADD CONSTRAINT "MarketplaceUserFlag_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MediaAccessEvent MediaAccessEvent_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MediaAccessEvent"
    ADD CONSTRAINT "MediaAccessEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Membership Membership_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Membership"
    ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Membership Membership_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Membership"
    ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessageParticipant MessageParticipant_partyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MessageParticipant"
    ADD CONSTRAINT "MessageParticipant_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES public."Party"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessageParticipant MessageParticipant_threadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MessageParticipant"
    ADD CONSTRAINT "MessageParticipant_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES public."MessageThread"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MessageThread MessageThread_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MessageThread"
    ADD CONSTRAINT "MessageThread_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Message Message_senderPartyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Message"
    ADD CONSTRAINT "Message_senderPartyId_fkey" FOREIGN KEY ("senderPartyId") REFERENCES public."Party"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Message Message_threadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Message"
    ADD CONSTRAINT "Message_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES public."MessageThread"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MilkingRecord MilkingRecord_animalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MilkingRecord"
    ADD CONSTRAINT "MilkingRecord_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MilkingRecord MilkingRecord_lactationCycleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MilkingRecord"
    ADD CONSTRAINT "MilkingRecord_lactationCycleId_fkey" FOREIGN KEY ("lactationCycleId") REFERENCES public."LactationCycle"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MilkingRecord MilkingRecord_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MilkingRecord"
    ADD CONSTRAINT "MilkingRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: NeonatalCareEntry NeonatalCareEntry_offspringId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."NeonatalCareEntry"
    ADD CONSTRAINT "NeonatalCareEntry_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES public."Offspring"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: NeonatalCareEntry NeonatalCareEntry_recordedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."NeonatalCareEntry"
    ADD CONSTRAINT "NeonatalCareEntry_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: NeonatalCareEntry NeonatalCareEntry_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."NeonatalCareEntry"
    ADD CONSTRAINT "NeonatalCareEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: NeonatalIntervention NeonatalIntervention_offspringId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."NeonatalIntervention"
    ADD CONSTRAINT "NeonatalIntervention_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES public."Offspring"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: NeonatalIntervention NeonatalIntervention_recordedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."NeonatalIntervention"
    ADD CONSTRAINT "NeonatalIntervention_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: NeonatalIntervention NeonatalIntervention_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."NeonatalIntervention"
    ADD CONSTRAINT "NeonatalIntervention_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: NetworkBreedingInquiry NetworkBreedingInquiry_messageThreadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."NetworkBreedingInquiry"
    ADD CONSTRAINT "NetworkBreedingInquiry_messageThreadId_fkey" FOREIGN KEY ("messageThreadId") REFERENCES public."MessageThread"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: NetworkBreedingInquiry NetworkBreedingInquiry_recipientTenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."NetworkBreedingInquiry"
    ADD CONSTRAINT "NetworkBreedingInquiry_recipientTenantId_fkey" FOREIGN KEY ("recipientTenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: NetworkBreedingInquiry NetworkBreedingInquiry_senderTenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."NetworkBreedingInquiry"
    ADD CONSTRAINT "NetworkBreedingInquiry_senderTenantId_fkey" FOREIGN KEY ("senderTenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: NetworkSearchIndex NetworkSearchIndex_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."NetworkSearchIndex"
    ADD CONSTRAINT "NetworkSearchIndex_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Notification Notification_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Notification Notification_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OffspringContract OffspringContract_buyerPartyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OffspringContract"
    ADD CONSTRAINT "OffspringContract_buyerPartyId_fkey" FOREIGN KEY ("buyerPartyId") REFERENCES public."Party"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: OffspringContract OffspringContract_fileId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OffspringContract"
    ADD CONSTRAINT "OffspringContract_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES public."Attachment"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: OffspringContract OffspringContract_offspringId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OffspringContract"
    ADD CONSTRAINT "OffspringContract_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES public."Offspring"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OffspringContract OffspringContract_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OffspringContract"
    ADD CONSTRAINT "OffspringContract_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OffspringDocument OffspringDocument_fileId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OffspringDocument"
    ADD CONSTRAINT "OffspringDocument_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES public."Attachment"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: OffspringDocument OffspringDocument_offspringId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OffspringDocument"
    ADD CONSTRAINT "OffspringDocument_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES public."Offspring"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OffspringDocument OffspringDocument_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OffspringDocument"
    ADD CONSTRAINT "OffspringDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OffspringEvent OffspringEvent_offspringId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OffspringEvent"
    ADD CONSTRAINT "OffspringEvent_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES public."Offspring"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OffspringEvent OffspringEvent_recordedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OffspringEvent"
    ADD CONSTRAINT "OffspringEvent_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: OffspringEvent OffspringEvent_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OffspringEvent"
    ADD CONSTRAINT "OffspringEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OffspringInvoiceLink OffspringInvoiceLink_invoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OffspringInvoiceLink"
    ADD CONSTRAINT "OffspringInvoiceLink_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES public."Invoice"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: OffspringInvoiceLink OffspringInvoiceLink_offspringId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OffspringInvoiceLink"
    ADD CONSTRAINT "OffspringInvoiceLink_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES public."Offspring"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OffspringInvoiceLink OffspringInvoiceLink_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OffspringInvoiceLink"
    ADD CONSTRAINT "OffspringInvoiceLink_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OffspringProtocolException OffspringProtocolException_assignmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OffspringProtocolException"
    ADD CONSTRAINT "OffspringProtocolException_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES public."RearingProtocolAssignment"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OffspringProtocolException OffspringProtocolException_offspringId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OffspringProtocolException"
    ADD CONSTRAINT "OffspringProtocolException_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES public."Offspring"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OffspringProtocolException OffspringProtocolException_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OffspringProtocolException"
    ADD CONSTRAINT "OffspringProtocolException_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Offspring Offspring_breedingPlanId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Offspring"
    ADD CONSTRAINT "Offspring_breedingPlanId_fkey" FOREIGN KEY ("breedingPlanId") REFERENCES public."BreedingPlan"(id) ON DELETE CASCADE;


--
-- Name: Offspring Offspring_buyerPartyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Offspring"
    ADD CONSTRAINT "Offspring_buyerPartyId_fkey" FOREIGN KEY ("buyerPartyId") REFERENCES public."Party"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Offspring Offspring_damId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Offspring"
    ADD CONSTRAINT "Offspring_damId_fkey" FOREIGN KEY ("damId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Offspring Offspring_promotedAnimalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Offspring"
    ADD CONSTRAINT "Offspring_promotedAnimalId_fkey" FOREIGN KEY ("promotedAnimalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Offspring Offspring_sireId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Offspring"
    ADD CONSTRAINT "Offspring_sireId_fkey" FOREIGN KEY ("sireId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Offspring Offspring_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Offspring"
    ADD CONSTRAINT "Offspring_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Organization Organization_partyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Organization"
    ADD CONSTRAINT "Organization_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES public."Party"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Organization Organization_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Organization"
    ADD CONSTRAINT "Organization_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PartyActivity PartyActivity_partyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PartyActivity"
    ADD CONSTRAINT "PartyActivity_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES public."Party"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PartyActivity PartyActivity_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PartyActivity"
    ADD CONSTRAINT "PartyActivity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PartyCommPreferenceEvent PartyCommPreferenceEvent_partyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PartyCommPreferenceEvent"
    ADD CONSTRAINT "PartyCommPreferenceEvent_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES public."Party"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PartyCommPreference PartyCommPreference_partyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PartyCommPreference"
    ADD CONSTRAINT "PartyCommPreference_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES public."Party"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PartyEmail PartyEmail_partyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PartyEmail"
    ADD CONSTRAINT "PartyEmail_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES public."Party"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PartyEmail PartyEmail_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PartyEmail"
    ADD CONSTRAINT "PartyEmail_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PartyEvent PartyEvent_partyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PartyEvent"
    ADD CONSTRAINT "PartyEvent_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES public."Party"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PartyEvent PartyEvent_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PartyEvent"
    ADD CONSTRAINT "PartyEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PartyMilestone PartyMilestone_partyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PartyMilestone"
    ADD CONSTRAINT "PartyMilestone_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES public."Party"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PartyMilestone PartyMilestone_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PartyMilestone"
    ADD CONSTRAINT "PartyMilestone_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PartyNote PartyNote_partyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PartyNote"
    ADD CONSTRAINT "PartyNote_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES public."Party"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PartyNote PartyNote_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PartyNote"
    ADD CONSTRAINT "PartyNote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Party Party_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Party"
    ADD CONSTRAINT "Party_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PaymentIntent PaymentIntent_animalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PaymentIntent"
    ADD CONSTRAINT "PaymentIntent_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PaymentIntent PaymentIntent_invoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PaymentIntent"
    ADD CONSTRAINT "PaymentIntent_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES public."Invoice"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PaymentIntent PaymentIntent_ownershipChangeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PaymentIntent"
    ADD CONSTRAINT "PaymentIntent_ownershipChangeId_fkey" FOREIGN KEY ("ownershipChangeId") REFERENCES public."AnimalOwnershipChange"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PaymentIntent PaymentIntent_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PaymentIntent"
    ADD CONSTRAINT "PaymentIntent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PaymentMethod PaymentMethod_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PaymentMethod"
    ADD CONSTRAINT "PaymentMethod_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Payment Payment_invoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES public."Invoice"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Payment Payment_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PlanCodeCounter PlanCodeCounter_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PlanCodeCounter"
    ADD CONSTRAINT "PlanCodeCounter_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PlanParty PlanParty_partyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PlanParty"
    ADD CONSTRAINT "PlanParty_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES public."Party"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PlanParty PlanParty_planId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PlanParty"
    ADD CONSTRAINT "PlanParty_planId_fkey" FOREIGN KEY ("planId") REFERENCES public."BreedingPlan"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PlanParty PlanParty_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PlanParty"
    ADD CONSTRAINT "PlanParty_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PortalAccess PortalAccess_createdByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PortalAccess"
    ADD CONSTRAINT "PortalAccess_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PortalAccess PortalAccess_partyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PortalAccess"
    ADD CONSTRAINT "PortalAccess_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES public."Party"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PortalAccess PortalAccess_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PortalAccess"
    ADD CONSTRAINT "PortalAccess_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PortalAccess PortalAccess_updatedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PortalAccess"
    ADD CONSTRAINT "PortalAccess_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PortalAccess PortalAccess_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PortalAccess"
    ADD CONSTRAINT "PortalAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PortalInvite PortalInvite_partyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PortalInvite"
    ADD CONSTRAINT "PortalInvite_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES public."Party"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PortalInvite PortalInvite_sentByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PortalInvite"
    ADD CONSTRAINT "PortalInvite_sentByUserId_fkey" FOREIGN KEY ("sentByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PortalInvite PortalInvite_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PortalInvite"
    ADD CONSTRAINT "PortalInvite_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PortalInvite PortalInvite_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PortalInvite"
    ADD CONSTRAINT "PortalInvite_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PregnancyCheck PregnancyCheck_planId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PregnancyCheck"
    ADD CONSTRAINT "PregnancyCheck_planId_fkey" FOREIGN KEY ("planId") REFERENCES public."BreedingPlan"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PregnancyCheck PregnancyCheck_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PregnancyCheck"
    ADD CONSTRAINT "PregnancyCheck_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ProductEntitlement ProductEntitlement_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProductEntitlement"
    ADD CONSTRAINT "ProductEntitlement_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ProtocolComment ProtocolComment_parentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProtocolComment"
    ADD CONSTRAINT "ProtocolComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES public."ProtocolComment"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ProtocolComment ProtocolComment_protocolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProtocolComment"
    ADD CONSTRAINT "ProtocolComment_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES public."RearingProtocol"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ProtocolComment ProtocolComment_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProtocolComment"
    ADD CONSTRAINT "ProtocolComment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ProtocolCopyRecord ProtocolCopyRecord_protocolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProtocolCopyRecord"
    ADD CONSTRAINT "ProtocolCopyRecord_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES public."RearingProtocol"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ProtocolCopyRecord ProtocolCopyRecord_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProtocolCopyRecord"
    ADD CONSTRAINT "ProtocolCopyRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ProtocolRating ProtocolRating_protocolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProtocolRating"
    ADD CONSTRAINT "ProtocolRating_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES public."RearingProtocol"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ProtocolRating ProtocolRating_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProtocolRating"
    ADD CONSTRAINT "ProtocolRating_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RearingCertificate RearingCertificate_assignmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RearingCertificate"
    ADD CONSTRAINT "RearingCertificate_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES public."RearingProtocolAssignment"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RearingCertificate RearingCertificate_offspringId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RearingCertificate"
    ADD CONSTRAINT "RearingCertificate_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES public."Offspring"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RearingCertificate RearingCertificate_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RearingCertificate"
    ADD CONSTRAINT "RearingCertificate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RearingProtocolActivity RearingProtocolActivity_stageId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RearingProtocolActivity"
    ADD CONSTRAINT "RearingProtocolActivity_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES public."RearingProtocolStage"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RearingProtocolAssignment RearingProtocolAssignment_animalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RearingProtocolAssignment"
    ADD CONSTRAINT "RearingProtocolAssignment_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RearingProtocolAssignment RearingProtocolAssignment_breedingPlanId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RearingProtocolAssignment"
    ADD CONSTRAINT "RearingProtocolAssignment_breedingPlanId_fkey" FOREIGN KEY ("breedingPlanId") REFERENCES public."BreedingPlan"(id) ON DELETE CASCADE;


--
-- Name: RearingProtocolAssignment RearingProtocolAssignment_handoffByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RearingProtocolAssignment"
    ADD CONSTRAINT "RearingProtocolAssignment_handoffByUserId_fkey" FOREIGN KEY ("handoffByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: RearingProtocolAssignment RearingProtocolAssignment_handoffToUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RearingProtocolAssignment"
    ADD CONSTRAINT "RearingProtocolAssignment_handoffToUserId_fkey" FOREIGN KEY ("handoffToUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: RearingProtocolAssignment RearingProtocolAssignment_offspringId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RearingProtocolAssignment"
    ADD CONSTRAINT "RearingProtocolAssignment_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES public."Offspring"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RearingProtocolAssignment RearingProtocolAssignment_protocolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RearingProtocolAssignment"
    ADD CONSTRAINT "RearingProtocolAssignment_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES public."RearingProtocol"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: RearingProtocolAssignment RearingProtocolAssignment_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RearingProtocolAssignment"
    ADD CONSTRAINT "RearingProtocolAssignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RearingProtocolStage RearingProtocolStage_protocolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RearingProtocolStage"
    ADD CONSTRAINT "RearingProtocolStage_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES public."RearingProtocol"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RearingProtocol RearingProtocol_parentProtocolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RearingProtocol"
    ADD CONSTRAINT "RearingProtocol_parentProtocolId_fkey" FOREIGN KEY ("parentProtocolId") REFERENCES public."RearingProtocol"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: RearingProtocol RearingProtocol_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RearingProtocol"
    ADD CONSTRAINT "RearingProtocol_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RegistryConnection RegistryConnection_registryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RegistryConnection"
    ADD CONSTRAINT "RegistryConnection_registryId_fkey" FOREIGN KEY ("registryId") REFERENCES public."Registry"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RegistryConnection RegistryConnection_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RegistryConnection"
    ADD CONSTRAINT "RegistryConnection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RegistryPedigree RegistryPedigree_animalRegistryIdentifierId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RegistryPedigree"
    ADD CONSTRAINT "RegistryPedigree_animalRegistryIdentifierId_fkey" FOREIGN KEY ("animalRegistryIdentifierId") REFERENCES public."AnimalRegistryIdentifier"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RegistryPedigree RegistryPedigree_linkedAnimalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RegistryPedigree"
    ADD CONSTRAINT "RegistryPedigree_linkedAnimalId_fkey" FOREIGN KEY ("linkedAnimalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: RegistrySyncLog RegistrySyncLog_initiatedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RegistrySyncLog"
    ADD CONSTRAINT "RegistrySyncLog_initiatedByUserId_fkey" FOREIGN KEY ("initiatedByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: RegistrySyncLog RegistrySyncLog_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RegistrySyncLog"
    ADD CONSTRAINT "RegistrySyncLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RegistryVerification RegistryVerification_animalRegistryIdentifierId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RegistryVerification"
    ADD CONSTRAINT "RegistryVerification_animalRegistryIdentifierId_fkey" FOREIGN KEY ("animalRegistryIdentifierId") REFERENCES public."AnimalRegistryIdentifier"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RegistryVerification RegistryVerification_verifiedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RegistryVerification"
    ADD CONSTRAINT "RegistryVerification_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ReproductiveCycle ReproductiveCycle_femaleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ReproductiveCycle"
    ADD CONSTRAINT "ReproductiveCycle_femaleId_fkey" FOREIGN KEY ("femaleId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ReproductiveCycle ReproductiveCycle_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ReproductiveCycle"
    ADD CONSTRAINT "ReproductiveCycle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SchedulingAvailabilityBlock SchedulingAvailabilityBlock_breedingPlanId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SchedulingAvailabilityBlock"
    ADD CONSTRAINT "SchedulingAvailabilityBlock_breedingPlanId_fkey" FOREIGN KEY ("breedingPlanId") REFERENCES public."BreedingPlan"(id);


--
-- Name: SchedulingAvailabilityBlock SchedulingAvailabilityBlock_templateId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SchedulingAvailabilityBlock"
    ADD CONSTRAINT "SchedulingAvailabilityBlock_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES public."SchedulingEventTemplate"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SchedulingAvailabilityBlock SchedulingAvailabilityBlock_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SchedulingAvailabilityBlock"
    ADD CONSTRAINT "SchedulingAvailabilityBlock_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SchedulingBooking SchedulingBooking_partyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SchedulingBooking"
    ADD CONSTRAINT "SchedulingBooking_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES public."Party"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SchedulingBooking SchedulingBooking_rescheduledFromId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SchedulingBooking"
    ADD CONSTRAINT "SchedulingBooking_rescheduledFromId_fkey" FOREIGN KEY ("rescheduledFromId") REFERENCES public."SchedulingBooking"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SchedulingBooking SchedulingBooking_slotId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SchedulingBooking"
    ADD CONSTRAINT "SchedulingBooking_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES public."SchedulingSlot"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SchedulingBooking SchedulingBooking_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SchedulingBooking"
    ADD CONSTRAINT "SchedulingBooking_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SchedulingEventTemplate SchedulingEventTemplate_offspringId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SchedulingEventTemplate"
    ADD CONSTRAINT "SchedulingEventTemplate_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES public."Offspring"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SchedulingEventTemplate SchedulingEventTemplate_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SchedulingEventTemplate"
    ADD CONSTRAINT "SchedulingEventTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SchedulingSlot SchedulingSlot_blockId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SchedulingSlot"
    ADD CONSTRAINT "SchedulingSlot_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES public."SchedulingAvailabilityBlock"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SchedulingSlot SchedulingSlot_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SchedulingSlot"
    ADD CONSTRAINT "SchedulingSlot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SemenInventory SemenInventory_stallionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SemenInventory"
    ADD CONSTRAINT "SemenInventory_stallionId_fkey" FOREIGN KEY ("stallionId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SemenInventory SemenInventory_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SemenInventory"
    ADD CONSTRAINT "SemenInventory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SemenUsage SemenUsage_breedingAttemptId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SemenUsage"
    ADD CONSTRAINT "SemenUsage_breedingAttemptId_fkey" FOREIGN KEY ("breedingAttemptId") REFERENCES public."BreedingAttempt"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SemenUsage SemenUsage_inventoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SemenUsage"
    ADD CONSTRAINT "SemenUsage_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES public."SemenInventory"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SemenUsage SemenUsage_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SemenUsage"
    ADD CONSTRAINT "SemenUsage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Sequence Sequence_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Sequence"
    ADD CONSTRAINT "Sequence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Session Session_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ShareCode ShareCode_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ShareCode"
    ADD CONSTRAINT "ShareCode_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ShearingRecord ShearingRecord_animalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ShearingRecord"
    ADD CONSTRAINT "ShearingRecord_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ShearingRecord ShearingRecord_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ShearingRecord"
    ADD CONSTRAINT "ShearingRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SignatureEvent SignatureEvent_contractId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SignatureEvent"
    ADD CONSTRAINT "SignatureEvent_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES public."Contract"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SignatureEvent SignatureEvent_partyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SignatureEvent"
    ADD CONSTRAINT "SignatureEvent_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES public."ContractParty"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SignatureEvent SignatureEvent_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SignatureEvent"
    ADD CONSTRAINT "SignatureEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: StudVisibilityRule StudVisibilityRule_inheritsFromId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StudVisibilityRule"
    ADD CONSTRAINT "StudVisibilityRule_inheritsFromId_fkey" FOREIGN KEY ("inheritsFromId") REFERENCES public."StudVisibilityRule"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: StudVisibilityRule StudVisibilityRule_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StudVisibilityRule"
    ADD CONSTRAINT "StudVisibilityRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SubscriptionAddOn SubscriptionAddOn_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SubscriptionAddOn"
    ADD CONSTRAINT "SubscriptionAddOn_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SubscriptionAddOn SubscriptionAddOn_subscriptionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SubscriptionAddOn"
    ADD CONSTRAINT "SubscriptionAddOn_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES public."Subscription"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Subscription Subscription_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Subscription"
    ADD CONSTRAINT "Subscription_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Subscription Subscription_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Subscription"
    ADD CONSTRAINT "Subscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SupplementAdministration SupplementAdministration_animalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SupplementAdministration"
    ADD CONSTRAINT "SupplementAdministration_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SupplementAdministration SupplementAdministration_scheduleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SupplementAdministration"
    ADD CONSTRAINT "SupplementAdministration_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES public."SupplementSchedule"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SupplementAdministration SupplementAdministration_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SupplementAdministration"
    ADD CONSTRAINT "SupplementAdministration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SupplementProtocol SupplementProtocol_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SupplementProtocol"
    ADD CONSTRAINT "SupplementProtocol_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SupplementSchedule SupplementSchedule_animalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SupplementSchedule"
    ADD CONSTRAINT "SupplementSchedule_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SupplementSchedule SupplementSchedule_breedingPlanId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SupplementSchedule"
    ADD CONSTRAINT "SupplementSchedule_breedingPlanId_fkey" FOREIGN KEY ("breedingPlanId") REFERENCES public."BreedingPlan"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SupplementSchedule SupplementSchedule_protocolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SupplementSchedule"
    ADD CONSTRAINT "SupplementSchedule_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES public."SupplementProtocol"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SupplementSchedule SupplementSchedule_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SupplementSchedule"
    ADD CONSTRAINT "SupplementSchedule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TagAssignment TagAssignment_animalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TagAssignment"
    ADD CONSTRAINT "TagAssignment_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TagAssignment TagAssignment_breedingPlanId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TagAssignment"
    ADD CONSTRAINT "TagAssignment_breedingPlanId_fkey" FOREIGN KEY ("breedingPlanId") REFERENCES public."BreedingPlan"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TagAssignment TagAssignment_buyerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TagAssignment"
    ADD CONSTRAINT "TagAssignment_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES public."Buyer"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TagAssignment TagAssignment_dealId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TagAssignment"
    ADD CONSTRAINT "TagAssignment_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES public."Deal"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TagAssignment TagAssignment_documentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TagAssignment"
    ADD CONSTRAINT "TagAssignment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES public."Document"(id) ON DELETE CASCADE;


--
-- Name: TagAssignment TagAssignment_draftId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TagAssignment"
    ADD CONSTRAINT "TagAssignment_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES public."Draft"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TagAssignment TagAssignment_messageThreadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TagAssignment"
    ADD CONSTRAINT "TagAssignment_messageThreadId_fkey" FOREIGN KEY ("messageThreadId") REFERENCES public."MessageThread"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TagAssignment TagAssignment_offspringId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TagAssignment"
    ADD CONSTRAINT "TagAssignment_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES public."Offspring"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TagAssignment TagAssignment_tagId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TagAssignment"
    ADD CONSTRAINT "TagAssignment_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES public."Tag"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TagAssignment TagAssignment_taggedPartyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TagAssignment"
    ADD CONSTRAINT "TagAssignment_taggedPartyId_fkey" FOREIGN KEY ("taggedPartyId") REFERENCES public."Party"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TagAssignment TagAssignment_waitlistEntryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TagAssignment"
    ADD CONSTRAINT "TagAssignment_waitlistEntryId_fkey" FOREIGN KEY ("waitlistEntryId") REFERENCES public."WaitlistEntry"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Tag Tag_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Tag"
    ADD CONSTRAINT "Tag_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Task Task_assignedToUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Task Task_offspringId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES public."Offspring"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Task Task_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TemplateContent TemplateContent_templateId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TemplateContent"
    ADD CONSTRAINT "TemplateContent_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES public."Template"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Template Template_createdByPartyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Template"
    ADD CONSTRAINT "Template_createdByPartyId_fkey" FOREIGN KEY ("createdByPartyId") REFERENCES public."Party"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Template Template_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Template"
    ADD CONSTRAINT "Template_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TenantMembership TenantMembership_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TenantMembership"
    ADD CONSTRAINT "TenantMembership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TenantMembership TenantMembership_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TenantMembership"
    ADD CONSTRAINT "TenantMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TenantProgramBreed TenantProgramBreed_breedId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TenantProgramBreed"
    ADD CONSTRAINT "TenantProgramBreed_breedId_fkey" FOREIGN KEY ("breedId") REFERENCES public."Breed"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TenantProgramBreed TenantProgramBreed_customBreedId_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TenantProgramBreed"
    ADD CONSTRAINT "TenantProgramBreed_customBreedId_tenantId_fkey" FOREIGN KEY ("customBreedId", "tenantId") REFERENCES public."CustomBreed"(id, "tenantId") ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TenantProgramBreed TenantProgramBreed_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TenantProgramBreed"
    ADD CONSTRAINT "TenantProgramBreed_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TenantSetting TenantSetting_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TenantSetting"
    ADD CONSTRAINT "TenantSetting_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TestResult TestResult_animalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TestResult"
    ADD CONSTRAINT "TestResult_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TestResult TestResult_planId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TestResult"
    ADD CONSTRAINT "TestResult_planId_fkey" FOREIGN KEY ("planId") REFERENCES public."BreedingPlan"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TestResult TestResult_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TestResult"
    ADD CONSTRAINT "TestResult_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TitleDefinition TitleDefinition_parentTitleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TitleDefinition"
    ADD CONSTRAINT "TitleDefinition_parentTitleId_fkey" FOREIGN KEY ("parentTitleId") REFERENCES public."TitleDefinition"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TitleDefinition TitleDefinition_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TitleDefinition"
    ADD CONSTRAINT "TitleDefinition_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TosAcceptance TosAcceptance_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TosAcceptance"
    ADD CONSTRAINT "TosAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UnlinkedEmail UnlinkedEmail_linkedPartyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UnlinkedEmail"
    ADD CONSTRAINT "UnlinkedEmail_linkedPartyId_fkey" FOREIGN KEY ("linkedPartyId") REFERENCES public."Party"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: UnlinkedEmail UnlinkedEmail_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UnlinkedEmail"
    ADD CONSTRAINT "UnlinkedEmail_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UsageRecord UsageRecord_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UsageRecord"
    ADD CONSTRAINT "UsageRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UsageSnapshot UsageSnapshot_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UsageSnapshot"
    ADD CONSTRAINT "UsageSnapshot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UserEntitlement UserEntitlement_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserEntitlement"
    ADD CONSTRAINT "UserEntitlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UserHelpPreference UserHelpPreference_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserHelpPreference"
    ADD CONSTRAINT "UserHelpPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON DELETE CASCADE;


--
-- Name: UserNotificationPreferences UserNotificationPreferences_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserNotificationPreferences"
    ADD CONSTRAINT "UserNotificationPreferences_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UserNotificationPreferences UserNotificationPreferences_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserNotificationPreferences"
    ADD CONSTRAINT "UserNotificationPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: User User_defaultTenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_defaultTenantId_fkey" FOREIGN KEY ("defaultTenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: User User_partyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES public."Party"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: VaccinationRecord VaccinationRecord_animalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VaccinationRecord"
    ADD CONSTRAINT "VaccinationRecord_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: VaccinationRecord VaccinationRecord_documentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VaccinationRecord"
    ADD CONSTRAINT "VaccinationRecord_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES public."Document"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: VaccinationRecord VaccinationRecord_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VaccinationRecord"
    ADD CONSTRAINT "VaccinationRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: VerificationToken VerificationToken_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VerificationToken"
    ADD CONSTRAINT "VerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: WaitlistEntry WaitlistEntry_animalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WaitlistEntry"
    ADD CONSTRAINT "WaitlistEntry_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: WaitlistEntry WaitlistEntry_buyerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WaitlistEntry"
    ADD CONSTRAINT "WaitlistEntry_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES public."Buyer"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: WaitlistEntry WaitlistEntry_clientPartyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WaitlistEntry"
    ADD CONSTRAINT "WaitlistEntry_clientPartyId_fkey" FOREIGN KEY ("clientPartyId") REFERENCES public."Party"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: WaitlistEntry WaitlistEntry_damPrefId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WaitlistEntry"
    ADD CONSTRAINT "WaitlistEntry_damPrefId_fkey" FOREIGN KEY ("damPrefId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: WaitlistEntry WaitlistEntry_litterId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WaitlistEntry"
    ADD CONSTRAINT "WaitlistEntry_litterId_fkey" FOREIGN KEY ("litterId") REFERENCES public."Litter"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: WaitlistEntry WaitlistEntry_offspringId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WaitlistEntry"
    ADD CONSTRAINT "WaitlistEntry_offspringId_fkey" FOREIGN KEY ("offspringId") REFERENCES public."Offspring"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: WaitlistEntry WaitlistEntry_planId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WaitlistEntry"
    ADD CONSTRAINT "WaitlistEntry_planId_fkey" FOREIGN KEY ("planId") REFERENCES public."BreedingPlan"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: WaitlistEntry WaitlistEntry_programId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WaitlistEntry"
    ADD CONSTRAINT "WaitlistEntry_programId_fkey" FOREIGN KEY ("programId") REFERENCES public.mkt_listing_breeding_program(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: WaitlistEntry WaitlistEntry_sirePrefId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WaitlistEntry"
    ADD CONSTRAINT "WaitlistEntry_sirePrefId_fkey" FOREIGN KEY ("sirePrefId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: WaitlistEntry WaitlistEntry_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WaitlistEntry"
    ADD CONSTRAINT "WaitlistEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: WatermarkedAsset WatermarkedAsset_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WatermarkedAsset"
    ADD CONSTRAINT "WatermarkedAsset_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: animal_loci animal_loci_animal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.animal_loci
    ADD CONSTRAINT animal_loci_animal_id_fkey FOREIGN KEY (animal_id) REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: devices devices_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT "devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: mkt_breeding_booking_animal mkt_breeding_booking_animal_animalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mkt_breeding_booking_animal
    ADD CONSTRAINT "mkt_breeding_booking_animal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: mkt_breeding_booking_animal mkt_breeding_booking_animal_bookingId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mkt_breeding_booking_animal
    ADD CONSTRAINT "mkt_breeding_booking_animal_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES public.mkt_listing_breeding_booking(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: mkt_listing_animal_program mkt_listing_animal_program_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mkt_listing_animal_program
    ADD CONSTRAINT "mkt_listing_animal_program_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: mkt_listing_breeding_booking mkt_listing_breeding_booking_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mkt_listing_breeding_booking
    ADD CONSTRAINT "mkt_listing_breeding_booking_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: mkt_listing_breeding_program mkt_listing_breeding_program_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mkt_listing_breeding_program
    ADD CONSTRAINT "mkt_listing_breeding_program_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: mkt_listing_individual_animal mkt_listing_individual_animal_animalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mkt_listing_individual_animal
    ADD CONSTRAINT "mkt_listing_individual_animal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES public."Animal"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: mkt_listing_individual_animal mkt_listing_individual_animal_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mkt_listing_individual_animal
    ADD CONSTRAINT "mkt_listing_individual_animal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict dbmate


--
-- Dbmate schema migrations
--

INSERT INTO public.schema_migrations (version) VALUES
    ('20260216185145'),
    ('20260218141720'),
    ('20260218150809'),
    ('20260218154311'),
    ('20260218160406'),
    ('20260218212731'),
    ('20260219141047'),
    ('20260219141056'),
    ('20260219144254'),
    ('20260219152550'),
    ('20260219153038'),
    ('20260219204630'),
    ('20260219204631'),
    ('20260219204632'),
    ('20260219204633'),
    ('20260220141500'),
    ('20260220145934'),
    ('20260220172740'),
    ('20260220174928'),
    ('20260220185006'),
    ('20260220223214'),
    ('20260221135145'),
    ('20260221232212'),
    ('20260221232216'),
    ('20260222141801'),
    ('20260223142154'),
    ('20260223142155'),
    ('20260223152034'),
    ('20260223172107'),
    ('20260223182250'),
    ('20260223190001'),
    ('20260223190002'),
    ('20260223190003'),
    ('20260223200001'),
    ('20260223200002'),
    ('20260223210001'),
    ('20260224130007'),
    ('20260224140001'),
    ('20260224140002'),
    ('20260224181747'),
    ('20260224200710');
