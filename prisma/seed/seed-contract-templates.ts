// prisma/seed/seed-contract-templates.ts
/**
 * Seed System Contract Templates
 *
 * Creates 6 pre-built contract templates available to all tiers:
 * 1. Puppy/Animal Sales Agreement
 * 2. Deposit Agreement
 * 3. Co-Ownership Agreement
 * 4. Guardian Home Agreement
 * 5. Stud Service Contract
 * 6. Health Guarantee
 */
import "./seed-env-bootstrap";
import { PrismaClient, ContractTemplateType, ContractTemplateCategory } from "@prisma/client";

const prisma = new PrismaClient();

interface ContractTemplateSeed {
  slug: string;
  name: string;
  description: string;
  category: ContractTemplateCategory;
  bodyHtml: string;
  mergeFields: string[];
}

// ────────────────────────────────────────────────────────────────────────────
// Template HTML Content
// ────────────────────────────────────────────────────────────────────────────

const SALES_AGREEMENT_HTML = `
<div style="font-family: Georgia, 'Times New Roman', serif; max-width: 800px; margin: 0 auto; line-height: 1.6;">

<div style="text-align: center; margin-bottom: 30px;">
<h1 style="font-size: 24px; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 2px;">Animal Sales Agreement</h1>
<p style="font-size: 14px; color: #666;">Purchase Contract and Health Guarantee</p>
<p style="font-size: 12px; margin-top: 15px;"><strong>Contract Number:</strong> {{contract.number}} &nbsp;&nbsp;|&nbsp;&nbsp; <strong>Date:</strong> {{contract.date}}</p>
</div>

<div style="background: #f8f9fa; border-left: 4px solid #2563eb; padding: 15px; margin-bottom: 25px;">
<p style="margin: 0; font-size: 13px;"><strong>This Agreement</strong> is entered into between the Seller and Buyer identified below for the sale and purchase of the animal described herein. Both parties agree to be bound by the terms and conditions set forth in this legally binding contract.</p>
</div>

<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">ARTICLE I: PARTIES</h2>

<div style="display: flex; gap: 40px; margin: 20px 0;">
<div style="flex: 1;">
<p style="font-weight: bold; margin-bottom: 5px; color: #2563eb;">SELLER</p>
<p style="margin: 3px 0;">{{breeder.businessName}}</p>
<p style="margin: 3px 0;">{{breeder.name}}</p>
<p style="margin: 3px 0;">{{breeder.address}}</p>
<p style="margin: 3px 0;">Phone: {{breeder.phone}}</p>
<p style="margin: 3px 0;">Email: {{breeder.email}}</p>
{{#if breeder.website}}<p style="margin: 3px 0;">Website: {{breeder.website}}</p>{{/if}}
</div>
<div style="flex: 1;">
<p style="font-weight: bold; margin-bottom: 5px; color: #2563eb;">BUYER</p>
<p style="margin: 3px 0;">{{buyer.name}}</p>
<p style="margin: 3px 0;">{{buyer.address}}</p>
<p style="margin: 3px 0;">Phone: {{buyer.phone}}</p>
<p style="margin: 3px 0;">Email: {{buyer.email}}</p>
</div>
</div>

<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">ARTICLE II: ANIMAL INFORMATION</h2>

<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
<tr style="background: #f8f9fa;">
<td style="padding: 10px; border: 1px solid #ddd; width: 30%;"><strong>Registered/Call Name:</strong></td>
<td style="padding: 10px; border: 1px solid #ddd;">{{animal.name}}</td>
</tr>
<tr>
<td style="padding: 10px; border: 1px solid #ddd;"><strong>Breed:</strong></td>
<td style="padding: 10px; border: 1px solid #ddd;">{{animal.breed}}</td>
</tr>
<tr style="background: #f8f9fa;">
<td style="padding: 10px; border: 1px solid #ddd;"><strong>Date of Birth:</strong></td>
<td style="padding: 10px; border: 1px solid #ddd;">{{animal.dateOfBirth}}</td>
</tr>
<tr>
<td style="padding: 10px; border: 1px solid #ddd;"><strong>Sex:</strong></td>
<td style="padding: 10px; border: 1px solid #ddd;">{{animal.sex}}</td>
</tr>
<tr style="background: #f8f9fa;">
<td style="padding: 10px; border: 1px solid #ddd;"><strong>Color/Markings:</strong></td>
<td style="padding: 10px; border: 1px solid #ddd;">{{animal.color}}</td>
</tr>
{{#if animal.registrationNumber}}
<tr>
<td style="padding: 10px; border: 1px solid #ddd;"><strong>Registration Number:</strong></td>
<td style="padding: 10px; border: 1px solid #ddd;">{{animal.registrationNumber}}</td>
</tr>
{{/if}}
{{#if animal.registrationOrg}}
<tr style="background: #f8f9fa;">
<td style="padding: 10px; border: 1px solid #ddd;"><strong>Registration Organization:</strong></td>
<td style="padding: 10px; border: 1px solid #ddd;">{{animal.registrationOrg}}</td>
</tr>
{{/if}}
{{#if animal.microchipNumber}}
<tr>
<td style="padding: 10px; border: 1px solid #ddd;"><strong>Microchip Number:</strong></td>
<td style="padding: 10px; border: 1px solid #ddd;">{{animal.microchipNumber}}</td>
</tr>
{{/if}}
{{#if animal.sire}}
<tr style="background: #f8f9fa;">
<td style="padding: 10px; border: 1px solid #ddd;"><strong>Sire (Father):</strong></td>
<td style="padding: 10px; border: 1px solid #ddd;">{{animal.sire}}</td>
</tr>
{{/if}}
{{#if animal.dam}}
<tr>
<td style="padding: 10px; border: 1px solid #ddd;"><strong>Dam (Mother):</strong></td>
<td style="padding: 10px; border: 1px solid #ddd;">{{animal.dam}}</td>
</tr>
{{/if}}
</table>

<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">ARTICLE III: PURCHASE TERMS</h2>

<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
<tr style="background: #f8f9fa;">
<td style="padding: 10px; border: 1px solid #ddd; width: 40%;"><strong>Total Purchase Price:</strong></td>
<td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; font-size: 18px;">{{transaction.totalPrice}}</td>
</tr>
{{#if transaction.depositAmount}}
<tr>
<td style="padding: 10px; border: 1px solid #ddd;"><strong>Deposit Paid:</strong></td>
<td style="padding: 10px; border: 1px solid #ddd;">{{transaction.depositAmount}} (paid on {{transaction.depositDate}})</td>
</tr>
<tr style="background: #f8f9fa;">
<td style="padding: 10px; border: 1px solid #ddd;"><strong>Balance Due:</strong></td>
<td style="padding: 10px; border: 1px solid #ddd;">{{transaction.balanceDue}}</td>
</tr>
{{/if}}
{{#if transaction.paymentTerms}}
<tr>
<td style="padding: 10px; border: 1px solid #ddd;"><strong>Payment Terms:</strong></td>
<td style="padding: 10px; border: 1px solid #ddd;">{{transaction.paymentTerms}}</td>
</tr>
{{/if}}
<tr style="background: #f8f9fa;">
<td style="padding: 10px; border: 1px solid #ddd;"><strong>Pickup/Delivery Date:</strong></td>
<td style="padding: 10px; border: 1px solid #ddd;">{{transaction.pickupDate}}</td>
</tr>
{{#if transaction.deliveryMethod}}
<tr>
<td style="padding: 10px; border: 1px solid #ddd;"><strong>Delivery Method:</strong></td>
<td style="padding: 10px; border: 1px solid #ddd;">{{transaction.deliveryMethod}}</td>
</tr>
{{/if}}
</table>

<p style="font-size: 13px; color: #666;"><strong>Accepted Payment Methods:</strong> Cash, certified check, wire transfer, or approved electronic payment. Personal checks require clearance before transfer of animal.</p>

<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">ARTICLE IV: SALE TYPE & REGISTRATION</h2>

<div style="background: #fff3cd; border: 1px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
<p style="margin: 0;"><strong>This animal is sold as:</strong></p>
<p style="margin: 10px 0 0 0;">{{contract.saleType}}</p>
</div>

<p><strong>4.1 Limited Registration (Pet Only):</strong> If sold with limited registration, the animal shall not be bred and Buyer agrees to spay/neuter by the age recommended by their veterinarian. Registration papers (if applicable) will reflect limited/pet-only status. Failure to comply voids all health guarantees.</p>

<p><strong>4.2 Full Registration (Breeding/Show):</strong> If sold with full registration, Buyer receives unrestricted registration papers and may show and/or breed the animal. Full registration commands a higher purchase price as noted above.</p>

<p><strong>4.3 Registration Transfer:</strong> Seller agrees to provide all necessary documentation for registration transfer within 30 days of full payment. If Seller fails to provide registration papers within 90 days, Buyer may request a partial refund.</p>

<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">ARTICLE V: HEALTH GUARANTEE</h2>

<h3 style="font-size: 14px; color: #2563eb;">5.1 Initial Health Examination (72 Hours)</h3>
<p>Seller guarantees the animal is in good health at time of sale. Buyer has <strong>seventy-two (72) hours</strong> from pickup to have the animal examined by a licensed veterinarian at Buyer's expense. If the veterinarian determines the animal has a serious illness or congenital defect that existed prior to sale, Buyer may:</p>
<ul>
<li><strong>Option A:</strong> Return the animal for a full refund of the purchase price</li>
<li><strong>Option B:</strong> Keep the animal and receive reimbursement for treatment up to the purchase price</li>
</ul>
<p style="font-size: 13px; color: #666;">Written veterinary documentation must be provided within 72 hours. Minor issues such as parasites, coccidiosis, giardia, or mild infections are treatable and not grounds for return.</p>

<h3 style="font-size: 14px; color: #2563eb;">5.2 Genetic Health Guarantee (2 Years)</h3>
<p>Seller guarantees this animal against debilitating genetic or hereditary defects for <strong>two (2) years</strong> from date of birth. Covered conditions must:</p>
<ul>
<li>Be diagnosed by a board-certified veterinary specialist</li>
<li>Significantly impact the animal's quality of life</li>
<li>Be confirmed as genetic/hereditary in origin</li>
</ul>
<p>If a covered genetic condition is confirmed:</p>
<ul>
<li><strong>Option A:</strong> Return the animal for a replacement of equal value when available</li>
<li><strong>Option B:</strong> Keep the animal and receive reimbursement of 50% of purchase price toward treatment</li>
</ul>

<h3 style="font-size: 14px; color: #2563eb;">5.3 Health Guarantee Conditions</h3>
<p>All health guarantees are <strong>VOID</strong> if:</p>
<ul>
<li>Animal is not fed a high-quality diet appropriate for the breed</li>
<li>Animal does not receive timely vaccinations and veterinary care</li>
<li>Animal is bred without Seller's written consent (for limited registration sales)</li>
<li>Animal is subjected to abuse, neglect, or hazardous conditions</li>
<li>Animal suffers injury from accident, poisoning, or Buyer negligence</li>
<li>Animal is spayed/neutered before 12 months of age (unless medically necessary with vet documentation)</li>
<li>Animal is allowed to become overweight or underweight</li>
</ul>

<h3 style="font-size: 14px; color: #2563eb;">5.4 Exclusions</h3>
<p>This guarantee does NOT cover: hypoglycemia, parasites, coccidia, giardia, kennel cough, allergies, skin conditions, umbilical hernias under 1 inch, elongated soft palate, stenotic nares, cherry eye, entropion, retained testicles (unilateral), behavioral issues, or any condition resulting from improper care.</p>

<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">ARTICLE VI: BUYER RESPONSIBILITIES</h2>

<p>Buyer agrees to:</p>
<ol>
<li>Provide proper food, shelter, medical care, and a loving home environment</li>
<li>Keep the animal as a household pet (not kenneled outdoors permanently)</li>
<li>Maintain current vaccinations and parasite prevention</li>
<li>Never surrender the animal to a shelter, rescue, or pound</li>
<li>Contact Seller first if unable to keep the animal for any reason</li>
<li>Not sell, transfer, or give away the animal without written Seller consent</li>
<li>Follow Seller's care instructions for at least the first 30 days</li>
</ol>

<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">ARTICLE VII: RETURN & REHOMING POLICY</h2>

<p><strong>7.1 Right of First Refusal:</strong> If at any time Buyer can no longer keep the animal, Buyer MUST contact Seller first. Seller has the right of first refusal to take back the animal. The animal shall NEVER be:</p>
<ul>
<li>Surrendered to any shelter, pound, or rescue organization</li>
<li>Sold or given to a pet store, broker, or research facility</li>
<li>Rehomed via online classifieds (Craigslist, Facebook, etc.) without Seller approval</li>
</ul>

<p><strong>7.2 Return for Rehoming:</strong> If returned to Seller, no refund is provided but Seller will make good-faith efforts to rehome the animal. If the animal is returned within the first 30 days due to Buyer's change of circumstances (not health-related), Seller may offer a partial refund at Seller's sole discretion.</p>

<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">ARTICLE VIII: LIMITATION OF LIABILITY</h2>

<p>Seller's total liability under this Agreement shall not exceed the original purchase price paid. Seller is not liable for any indirect, incidental, or consequential damages including but not limited to veterinary expenses beyond those explicitly covered, boarding costs, lost wages, emotional distress, or any other costs arising from ownership of this animal.</p>

<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">ARTICLE IX: DISPUTE RESOLUTION</h2>

<p><strong>9.1 Good Faith Resolution:</strong> Both parties agree to attempt resolution of any disputes in good faith through direct communication before pursuing other remedies.</p>

<p><strong>9.2 Mediation:</strong> If direct resolution fails, parties agree to submit to non-binding mediation before any legal action.</p>

<p><strong>9.3 Governing Law:</strong> This Agreement shall be governed by the laws of the State of {{breeder.state}}. Any legal action shall be filed in the county where Seller resides.</p>

<p><strong>9.4 Attorney's Fees:</strong> In any action to enforce this Agreement, the prevailing party shall be entitled to reasonable attorney's fees and costs.</p>

<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">ARTICLE X: ADDITIONAL TERMS</h2>

{{#if contract.additionalTerms}}
<div style="background: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 4px;">
{{contract.additionalTerms}}
</div>
{{/if}}

<p><strong>10.1 Entire Agreement:</strong> This Agreement constitutes the entire understanding between parties and supersedes all prior discussions, negotiations, or agreements, whether written or oral.</p>

<p><strong>10.2 Amendments:</strong> This Agreement may only be modified in writing signed by both parties.</p>

<p><strong>10.3 Severability:</strong> If any provision is found unenforceable, the remaining provisions remain in full effect.</p>

<p><strong>10.4 Binding Effect:</strong> This Agreement binds and benefits the parties and their respective heirs, successors, and assigns.</p>

<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">SIGNATURES & ACKNOWLEDGMENT</h2>

<div style="background: #e8f4fd; border: 1px solid #2563eb; padding: 15px; margin: 20px 0; border-radius: 4px;">
<p style="margin: 0; font-size: 13px;"><strong>BY SIGNING BELOW</strong>, both parties acknowledge they have read this entire Agreement, understand its terms and conditions, and agree to be legally bound by its provisions. Both parties have had the opportunity to seek legal counsel before signing.</p>
</div>

<div style="display: flex; gap: 40px; margin-top: 40px;">
<div style="flex: 1;">
<p style="font-weight: bold; margin-bottom: 5px;">SELLER</p>
<div style="border-bottom: 1px solid #000; width: 100%; height: 50px; margin-bottom: 10px;"></div>
<p style="margin: 3px 0;">{{breeder.name}}</p>
<p style="margin: 3px 0;">{{breeder.businessName}}</p>
<p style="margin: 3px 0;">Date: _______________</p>
</div>
<div style="flex: 1;">
<p style="font-weight: bold; margin-bottom: 5px;">BUYER</p>
<div style="border-bottom: 1px solid #000; width: 100%; height: 50px; margin-bottom: 10px;"></div>
<p style="margin: 3px 0;">{{buyer.name}}</p>
<p style="margin: 3px 0;">Date: _______________</p>
</div>
</div>

<div style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 11px; color: #666; text-align: center;">
<p>This contract was prepared using BreederHQ Contract Management System</p>
<p>Contract ID: {{contract.number}} | Generated: {{contract.date}}</p>
</div>

</div>
`;

const DEPOSIT_AGREEMENT_HTML = `
<div style="font-family: Georgia, 'Times New Roman', serif; max-width: 800px; margin: 0 auto; line-height: 1.6;">

<div style="text-align: center; margin-bottom: 30px;">
<h1 style="font-size: 24px; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 2px;">Deposit Agreement</h1>
<p style="font-size: 14px; color: #666;">Reservation Contract for Animal Purchase</p>
<p style="font-size: 12px; margin-top: 15px;"><strong>Agreement Number:</strong> {{contract.number}} &nbsp;&nbsp;|&nbsp;&nbsp; <strong>Date:</strong> {{contract.date}}</p>
</div>

<div style="background: #f8f9fa; border-left: 4px solid #2563eb; padding: 15px; margin-bottom: 25px;">
<p style="margin: 0; font-size: 13px;"><strong>This Deposit Agreement</strong> secures a reservation for the animal or litter placement described below. The deposit demonstrates Buyer's commitment and removes the reserved animal from availability to other prospective buyers.</p>
</div>

<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">ARTICLE I: PARTIES</h2>

<div style="display: flex; gap: 40px; margin: 20px 0;">
<div style="flex: 1;">
<p style="font-weight: bold; margin-bottom: 5px; color: #2563eb;">SELLER/BREEDER</p>
<p style="margin: 3px 0;">{{breeder.businessName}}</p>
<p style="margin: 3px 0;">{{breeder.name}}</p>
{{#if breeder.address}}<p style="margin: 3px 0;">{{breeder.address}}</p>{{/if}}
<p style="margin: 3px 0;">Phone: {{breeder.phone}}</p>
<p style="margin: 3px 0;">Email: {{breeder.email}}</p>
</div>
<div style="flex: 1;">
<p style="font-weight: bold; margin-bottom: 5px; color: #2563eb;">BUYER/DEPOSITOR</p>
<p style="margin: 3px 0;">{{buyer.name}}</p>
{{#if buyer.address}}<p style="margin: 3px 0;">{{buyer.address}}</p>{{/if}}
<p style="margin: 3px 0;">Phone: {{buyer.phone}}</p>
<p style="margin: 3px 0;">Email: {{buyer.email}}</p>
</div>
</div>

<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">ARTICLE II: RESERVATION DETAILS</h2>

<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
{{#if offspring.name}}
<tr style="background: #e8f4fd;">
<td style="padding: 10px; border: 1px solid #ddd; width: 30%;"><strong>Reserved Animal:</strong></td>
<td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">{{offspring.name}}</td>
</tr>
<tr>
<td style="padding: 10px; border: 1px solid #ddd;"><strong>Collar/Identifier:</strong></td>
<td style="padding: 10px; border: 1px solid #ddd;">{{offspring.collarColor}}</td>
</tr>
<tr style="background: #f8f9fa;">
<td style="padding: 10px; border: 1px solid #ddd;"><strong>Sex:</strong></td>
<td style="padding: 10px; border: 1px solid #ddd;">{{offspring.sex}}</td>
</tr>
<tr>
<td style="padding: 10px; border: 1px solid #ddd;"><strong>Date of Birth:</strong></td>
<td style="padding: 10px; border: 1px solid #ddd;">{{offspring.dateOfBirth}}</td>
</tr>
{{/if}}
{{#if animal.name}}
<tr style="background: #f8f9fa;">
<td style="padding: 10px; border: 1px solid #ddd;"><strong>Litter/Animal:</strong></td>
<td style="padding: 10px; border: 1px solid #ddd;">{{animal.name}}</td>
</tr>
{{/if}}
<tr>
<td style="padding: 10px; border: 1px solid #ddd;"><strong>Breed:</strong></td>
<td style="padding: 10px; border: 1px solid #ddd;">{{animal.breed}}</td>
</tr>
{{#if contract.pickPosition}}
<tr style="background: #e8f4fd;">
<td style="padding: 10px; border: 1px solid #ddd;"><strong>Pick Position:</strong></td>
<td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">{{contract.pickPosition}}</td>
</tr>
{{/if}}
</table>

<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">ARTICLE III: FINANCIAL TERMS</h2>

<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
<tr style="background: #e8f4fd;">
<td style="padding: 12px; border: 1px solid #ddd; width: 40%;"><strong>Deposit Amount:</strong></td>
<td style="padding: 12px; border: 1px solid #ddd; font-weight: bold; font-size: 18px; color: #2563eb;">{{transaction.depositAmount}}</td>
</tr>
<tr>
<td style="padding: 12px; border: 1px solid #ddd;"><strong>Total Purchase Price:</strong></td>
<td style="padding: 12px; border: 1px solid #ddd;">{{transaction.totalPrice}}</td>
</tr>
<tr style="background: #f8f9fa;">
<td style="padding: 12px; border: 1px solid #ddd;"><strong>Balance Due at Pickup:</strong></td>
<td style="padding: 12px; border: 1px solid #ddd;">{{transaction.balanceDue}}</td>
</tr>
{{#if transaction.pickupDate}}
<tr>
<td style="padding: 12px; border: 1px solid #ddd;"><strong>Estimated Pickup Date:</strong></td>
<td style="padding: 12px; border: 1px solid #ddd;">{{transaction.pickupDate}}</td>
</tr>
{{/if}}
</table>

<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">ARTICLE IV: DEPOSIT TERMS & CONDITIONS</h2>

<h3 style="font-size: 14px; color: #2563eb;">4.1 Purpose of Deposit</h3>
<p>This deposit serves to:</p>
<ul>
<li>Reserve the specific animal (if identified) or placement position in an upcoming litter</li>
<li>Remove the reserved animal/position from availability to other buyers</li>
<li>Demonstrate Buyer's serious commitment to completing the purchase</li>
<li>Be applied as credit toward the total purchase price</li>
</ul>

<h3 style="font-size: 14px; color: #2563eb;">4.2 Deposit is NON-REFUNDABLE When:</h3>
<div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 15px 0;">
<ul style="margin: 0; padding-left: 20px;">
<li>Buyer changes their mind for any reason</li>
<li>Buyer's personal circumstances change (relocation, financial, family, etc.)</li>
<li>Buyer fails to respond to communications within 72 hours</li>
<li>Buyer fails to complete purchase within 14 days of animal being ready</li>
<li>Buyer fails to provide a suitable home environment as determined by Seller</li>
<li>Buyer is found to have provided false information on their application</li>
</ul>
</div>

<h3 style="font-size: 14px; color: #2563eb;">4.3 Deposit IS Refundable When:</h3>
<div style="background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 15px 0;">
<ul style="margin: 0; padding-left: 20px;">
<li>The reserved animal dies or develops a serious health condition before pickup</li>
<li>The breeding does not occur or fails to produce viable offspring</li>
<li>The litter does not produce an animal matching Buyer's documented preferences</li>
<li>Seller is unable to fulfill the reservation for any reason within Seller's control</li>
<li>Seller cancels the reservation without cause</li>
</ul>
</div>

<h3 style="font-size: 14px; color: #2563eb;">4.4 Deposit Transfer Option</h3>
<p>At Seller's sole discretion, if the reserved animal becomes unavailable through no fault of Buyer, the deposit may be transferred to another animal or future litter. Deposit transfers are valid for 12 months from the original deposit date.</p>

<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">ARTICLE V: OBLIGATIONS</h2>

<p><strong>5.1 Buyer Obligations:</strong></p>
<ul>
<li>Respond to Seller communications within 48-72 hours</li>
<li>Complete pickup within 14 days of animal being ready</li>
<li>Pay the remaining balance in full before or at time of pickup</li>
</ul>

<p><strong>5.2 Seller Obligations:</strong></p>
<ul>
<li>Hold the reserved animal/position exclusively for Buyer</li>
<li>Provide regular updates and photos during the waiting period</li>
<li>Notify Buyer promptly of any health concerns or changes</li>
<li>Ensure animal receives proper veterinary care, vaccinations, and socialization</li>
</ul>

<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">ARTICLE VI: ADDITIONAL TERMS</h2>

{{#if contract.additionalTerms}}
<div style="background: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 4px;">
{{contract.additionalTerms}}
</div>
{{/if}}

<p>This Deposit Agreement does not constitute a complete Sales Agreement. A full Sales Agreement with health guarantee will be provided at the time of pickup/delivery.</p>

<p>This Agreement is governed by the laws of the State of {{breeder.state}}.</p>

<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">SIGNATURES & ACKNOWLEDGMENT</h2>

<div style="background: #e8f4fd; border: 1px solid #2563eb; padding: 15px; margin: 20px 0; border-radius: 4px;">
<p style="margin: 0; font-size: 13px;"><strong>BY SIGNING BELOW</strong>, Buyer acknowledges they have read and understand this Deposit Agreement, agree to all terms and conditions, and confirm that the deposit amount specified above has been or will be submitted.</p>
</div>

<div style="display: flex; gap: 40px; margin-top: 40px;">
<div style="flex: 1;">
<p style="font-weight: bold; margin-bottom: 5px;">BUYER/DEPOSITOR</p>
<div style="border-bottom: 1px solid #000; width: 100%; height: 50px; margin-bottom: 10px;"></div>
<p style="margin: 3px 0;">{{buyer.name}}</p>
<p style="margin: 3px 0;">Date: _______________</p>
</div>
<div style="flex: 1;">
<p style="font-weight: bold; margin-bottom: 5px;">SELLER/BREEDER</p>
<div style="border-bottom: 1px solid #000; width: 100%; height: 50px; margin-bottom: 10px;"></div>
<p style="margin: 3px 0;">{{breeder.name}}</p>
<p style="margin: 3px 0;">{{breeder.businessName}}</p>
<p style="margin: 3px 0;">Date: _______________</p>
</div>
</div>

<div style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 11px; color: #666; text-align: center;">
<p>This deposit agreement was prepared using BreederHQ Contract Management System</p>
<p>Agreement ID: {{contract.number}} | Generated: {{contract.date}}</p>
</div>

</div>
`;

const CO_OWNERSHIP_AGREEMENT_HTML = `
<div style="font-family: Georgia, 'Times New Roman', serif; max-width: 800px; margin: 0 auto; line-height: 1.6;">

<div style="text-align: center; margin-bottom: 30px;">
<h1 style="font-size: 24px; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 2px;">Co-Ownership Agreement</h1>
<p style="font-size: 14px; color: #666;">Shared Ownership Contract for Breeding/Show Animal</p>
<p style="font-size: 12px; margin-top: 15px;"><strong>Agreement Number:</strong> {{contract.number}} &nbsp;&nbsp;|&nbsp;&nbsp; <strong>Effective Date:</strong> {{contract.date}}</p>
</div>

<div style="background: #f8f9fa; border-left: 4px solid #2563eb; padding: 15px; margin-bottom: 25px;">
<p style="margin: 0; font-size: 13px;"><strong>This Co-Ownership Agreement</strong> establishes shared ownership between the parties named below for the purpose of breeding, showing, and/or competition. Both parties shall have legal ownership interest in the animal described herein.</p>
</div>

<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">ARTICLE I: CO-OWNERS</h2>

<div style="display: flex; gap: 40px; margin: 20px 0;">
<div style="flex: 1;">
<p style="font-weight: bold; margin-bottom: 5px; color: #2563eb;">CO-OWNER A (BREEDER)</p>
<p style="margin: 3px 0;">{{breeder.businessName}}</p>
<p style="margin: 3px 0;">{{breeder.name}}</p>
<p style="margin: 3px 0;">{{breeder.address}}</p>
<p style="margin: 3px 0;">Phone: {{breeder.phone}}</p>
<p style="margin: 3px 0;">Email: {{breeder.email}}</p>
</div>
<div style="flex: 1;">
<p style="font-weight: bold; margin-bottom: 5px; color: #2563eb;">CO-OWNER B (BUYER)</p>
<p style="margin: 3px 0;">{{buyer.name}}</p>
<p style="margin: 3px 0;">{{buyer.address}}</p>
<p style="margin: 3px 0;">Phone: {{buyer.phone}}</p>
<p style="margin: 3px 0;">Email: {{buyer.email}}</p>
</div>
</div>

<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">ARTICLE II: ANIMAL INFORMATION</h2>

<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
<tr style="background: #e8f4fd;">
<td style="padding: 10px; border: 1px solid #ddd; width: 30%;"><strong>Registered Name:</strong></td>
<td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">{{animal.name}}</td>
</tr>
<tr style="background: #f8f9fa;">
<td style="padding: 10px; border: 1px solid #ddd;"><strong>Breed:</strong></td>
<td style="padding: 10px; border: 1px solid #ddd;">{{animal.breed}}</td>
</tr>
<tr>
<td style="padding: 10px; border: 1px solid #ddd;"><strong>Date of Birth:</strong></td>
<td style="padding: 10px; border: 1px solid #ddd;">{{animal.dateOfBirth}}</td>
</tr>
<tr style="background: #f8f9fa;">
<td style="padding: 10px; border: 1px solid #ddd;"><strong>Sex:</strong></td>
<td style="padding: 10px; border: 1px solid #ddd;">{{animal.sex}}</td>
</tr>
<tr>
<td style="padding: 10px; border: 1px solid #ddd;"><strong>Color/Markings:</strong></td>
<td style="padding: 10px; border: 1px solid #ddd;">{{animal.color}}</td>
</tr>
<tr style="background: #f8f9fa;">
<td style="padding: 10px; border: 1px solid #ddd;"><strong>Registration Number:</strong></td>
<td style="padding: 10px; border: 1px solid #ddd;">{{animal.registrationNumber}}</td>
</tr>
{{#if animal.microchipNumber}}
<tr>
<td style="padding: 10px; border: 1px solid #ddd;"><strong>Microchip Number:</strong></td>
<td style="padding: 10px; border: 1px solid #ddd;">{{animal.microchipNumber}}</td>
</tr>
{{/if}}
</table>

<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">ARTICLE III: OWNERSHIP & FINANCIAL TERMS</h2>

<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
<tr style="background: #e8f4fd;">
<td style="padding: 12px; border: 1px solid #ddd; width: 50%;"><strong>Co-Owner A (Breeder) Ownership:</strong></td>
<td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">50%</td>
</tr>
<tr>
<td style="padding: 12px; border: 1px solid #ddd;"><strong>Co-Owner B Ownership:</strong></td>
<td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">50%</td>
</tr>
<tr style="background: #f8f9fa;">
<td style="padding: 12px; border: 1px solid #ddd;"><strong>Full Market Value:</strong></td>
<td style="padding: 12px; border: 1px solid #ddd;">{{transaction.totalPrice}}</td>
</tr>
{{#if transaction.depositAmount}}
<tr>
<td style="padding: 12px; border: 1px solid #ddd;"><strong>Amount Paid by Co-Owner B:</strong></td>
<td style="padding: 12px; border: 1px solid #ddd;">{{transaction.depositAmount}}</td>
</tr>
{{/if}}
</table>

<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">ARTICLE IV: PHYSICAL CUSTODY & CARE</h2>

<p><strong>4.1 Primary Custodian:</strong> Co-Owner B shall have primary physical custody of the animal and shall be responsible for:</p>
<ul>
<li>Providing a safe, clean, loving home environment</li>
<li>Feeding a high-quality diet approved by Co-Owner A</li>
<li>Maintaining the animal in proper weight and condition</li>
<li>Providing all routine veterinary care (vaccinations, parasite prevention, dental care)</li>
</ul>

<p><strong>4.2 Expenses:</strong> All costs related to daily care, routine veterinary care, and housing shall be borne by Co-Owner B. Major medical expenses exceeding $1,000 shall be discussed and may be shared by mutual agreement.</p>

<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">ARTICLE V: BREEDING RIGHTS & ARRANGEMENTS</h2>

<p><strong>5.1 Breeding Authority:</strong> Co-Owner A (Breeder) retains primary breeding authority. All breeding decisions must be mutually agreed upon by both parties in writing.</p>

<p><strong>5.2 Breeding Requirements:</strong></p>
<ul>
<li>Maximum Litters: As agreed between parties</li>
<li>Minimum Age for First Breeding: 18 months or after health clearances completed</li>
<li>Maximum Age for Breeding: 6 years</li>
</ul>

<p><strong>5.3 Litter Distribution:</strong></p>
<ul>
<li>Co-Owner A is entitled to first pick from each litter</li>
<li>Remaining offspring shall be placed by mutual agreement</li>
<li>Revenue from puppy sales shall be split as agreed</li>
</ul>

<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">ARTICLE VI: SHOWING & COMPETITION</h2>

<p><strong>6.1 Show Rights:</strong> Both co-owners have the right to show the animal in conformation, performance, or other competitive events.</p>

<p><strong>6.2 Titles & Recognition:</strong> All championship titles, performance titles, and awards earned are shared and shall reflect both co-owners.</p>

<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">ARTICLE VII: TRANSFER OF FULL OWNERSHIP</h2>

<div style="background: #d4edda; border: 1px solid #28a745; padding: 15px; margin: 20px 0; border-radius: 4px;">
<p style="margin: 0; font-weight: bold;">Full ownership transfers to Co-Owner B upon completion of ALL the following:</p>
</div>

<ol>
<li>Completion of all required breeding arrangements</li>
<li>Completion of all required health testing with passing results</li>
<li>Payment of any remaining financial balance</li>
<li>Animal has reached retirement age or breeding career is complete</li>
<li>Co-Owner A provides written release of co-ownership</li>
</ol>

<p><strong>Upon Transfer:</strong> Animal shall be spayed/neutered at Co-Owner A's expense, and registration shall be transferred to Co-Owner B's name only.</p>

<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">ARTICLE VIII: TERMINATION & DISPUTE RESOLUTION</h2>

<p><strong>8.1 Early Termination:</strong> This agreement may be terminated by mutual written consent. If Co-Owner B wishes to terminate early, Co-Owner A has the right to purchase Co-Owner B's interest or take back physical custody.</p>

<p><strong>8.2 Dispute Resolution:</strong> Both parties agree to attempt resolution through direct communication first, then non-binding mediation before any legal action.</p>

<p><strong>8.3 Governing Law:</strong> This Agreement is governed by the laws of the State of {{breeder.state}}.</p>

{{#if contract.additionalTerms}}
<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">ADDITIONAL TERMS</h2>
<div style="background: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 4px;">
{{contract.additionalTerms}}
</div>
{{/if}}

<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">SIGNATURES & ACKNOWLEDGMENT</h2>

<div style="background: #e8f4fd; border: 1px solid #2563eb; padding: 15px; margin: 20px 0; border-radius: 4px;">
<p style="margin: 0; font-size: 13px;"><strong>BY SIGNING BELOW</strong>, both parties acknowledge they have read and understand this Co-Ownership Agreement in its entirety, agree to all terms and conditions, and enter into this agreement voluntarily.</p>
</div>

<div style="display: flex; gap: 40px; margin-top: 40px;">
<div style="flex: 1;">
<p style="font-weight: bold; margin-bottom: 5px;">CO-OWNER A (BREEDER)</p>
<div style="border-bottom: 1px solid #000; width: 100%; height: 50px; margin-bottom: 10px;"></div>
<p style="margin: 3px 0;">{{breeder.name}}</p>
<p style="margin: 3px 0;">{{breeder.businessName}}</p>
<p style="margin: 3px 0;">Date: _______________</p>
</div>
<div style="flex: 1;">
<p style="font-weight: bold; margin-bottom: 5px;">CO-OWNER B</p>
<div style="border-bottom: 1px solid #000; width: 100%; height: 50px; margin-bottom: 10px;"></div>
<p style="margin: 3px 0;">{{buyer.name}}</p>
<p style="margin: 3px 0;">Date: _______________</p>
</div>
</div>

<div style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 11px; color: #666; text-align: center;">
<p>This co-ownership agreement was prepared using BreederHQ Contract Management System</p>
<p>Agreement ID: {{contract.number}} | Generated: {{contract.date}}</p>
</div>

</div>
`;

const GUARDIAN_HOME_AGREEMENT_HTML = `
<div style="font-family: Georgia, 'Times New Roman', serif; max-width: 800px; margin: 0 auto; line-height: 1.6;">

<div style="text-align: center; margin-bottom: 30px;">
<h1 style="font-size: 24px; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 2px;">Guardian Home Agreement</h1>
<p style="font-size: 14px; color: #666;">Breeding Rights Retention & Care Agreement</p>
<p style="font-size: 12px; margin-top: 15px;"><strong>Agreement Number:</strong> {{contract.number}} &nbsp;&nbsp;|&nbsp;&nbsp; <strong>Effective Date:</strong> {{contract.date}}</p>
</div>

<div style="background: #e8f4fd; border-left: 4px solid #2563eb; padding: 15px; margin-bottom: 25px;">
<p style="margin: 0; font-size: 13px;"><strong>Guardian Home Program Overview:</strong> This program allows a carefully selected family to enjoy a high-quality animal as their beloved pet at a reduced cost, while the Breeder retains breeding rights. Upon completion of breeding obligations, full ownership transfers to the Guardian with no further obligations.</p>
</div>

<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">ARTICLE I: PARTIES</h2>

<div style="display: flex; gap: 40px; margin: 20px 0;">
<div style="flex: 1;">
<p style="font-weight: bold; margin-bottom: 5px; color: #2563eb;">BREEDER</p>
<p style="margin: 3px 0;">{{breeder.businessName}}</p>
<p style="margin: 3px 0;">{{breeder.name}}</p>
<p style="margin: 3px 0;">{{breeder.address}}</p>
<p style="margin: 3px 0;">Phone: {{breeder.phone}}</p>
<p style="margin: 3px 0;">Email: {{breeder.email}}</p>
</div>
<div style="flex: 1;">
<p style="font-weight: bold; margin-bottom: 5px; color: #2563eb;">GUARDIAN</p>
<p style="margin: 3px 0;">{{buyer.name}}</p>
<p style="margin: 3px 0;">{{buyer.address}}</p>
<p style="margin: 3px 0;">Phone: {{buyer.phone}}</p>
<p style="margin: 3px 0;">Email: {{buyer.email}}</p>
</div>
</div>

<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">ARTICLE II: ANIMAL INFORMATION</h2>

<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
<tr style="background: #e8f4fd;">
<td style="padding: 10px; border: 1px solid #ddd; width: 30%;"><strong>Registered Name:</strong></td>
<td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">{{animal.name}}</td>
</tr>
<tr style="background: #f8f9fa;">
<td style="padding: 10px; border: 1px solid #ddd;"><strong>Breed:</strong></td>
<td style="padding: 10px; border: 1px solid #ddd;">{{animal.breed}}</td>
</tr>
<tr>
<td style="padding: 10px; border: 1px solid #ddd;"><strong>Date of Birth:</strong></td>
<td style="padding: 10px; border: 1px solid #ddd;">{{animal.dateOfBirth}}</td>
</tr>
<tr style="background: #f8f9fa;">
<td style="padding: 10px; border: 1px solid #ddd;"><strong>Sex:</strong></td>
<td style="padding: 10px; border: 1px solid #ddd;">{{animal.sex}}</td>
</tr>
<tr>
<td style="padding: 10px; border: 1px solid #ddd;"><strong>Color/Markings:</strong></td>
<td style="padding: 10px; border: 1px solid #ddd;">{{animal.color}}</td>
</tr>
{{#if animal.registrationNumber}}
<tr style="background: #f8f9fa;">
<td style="padding: 10px; border: 1px solid #ddd;"><strong>Registration Number:</strong></td>
<td style="padding: 10px; border: 1px solid #ddd;">{{animal.registrationNumber}}</td>
</tr>
{{/if}}
{{#if animal.microchipNumber}}
<tr>
<td style="padding: 10px; border: 1px solid #ddd;"><strong>Microchip Number:</strong></td>
<td style="padding: 10px; border: 1px solid #ddd;">{{animal.microchipNumber}}</td>
</tr>
{{/if}}
</table>

<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">ARTICLE III: FINANCIAL TERMS</h2>

<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
<tr style="background: #d4edda;">
<td style="padding: 12px; border: 1px solid #ddd; width: 40%;"><strong>Guardian Price:</strong></td>
<td style="padding: 12px; border: 1px solid #ddd; font-weight: bold; font-size: 18px; color: #28a745;">{{transaction.totalPrice}}</td>
</tr>
</table>

<p style="font-size: 13px; color: #666;"><strong>Note:</strong> The reduced guardian price reflects the value of breeding rights retained by Breeder. Guardian receives a premium animal at a significant discount in exchange for cooperating with the breeding program.</p>

<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">ARTICLE IV: GUARDIAN RESPONSIBILITIES</h2>

<h3 style="font-size: 14px; color: #2563eb;">4.1 Home Environment</h3>
<p>Guardian agrees to provide:</p>
<ul>
<li>A loving, safe, indoor home environment (animal must live inside the home)</li>
<li>Secure fencing or leash-walking only (no electronic/invisible fences)</li>
<li>Climate-controlled living space</li>
</ul>

<h3 style="font-size: 14px; color: #2563eb;">4.2 Nutrition & Care</h3>
<ul>
<li>Feed only Breeder-approved, high-quality food</li>
<li>Maintain the animal at an ideal weight</li>
<li>Maintain all vaccinations on schedule</li>
<li>Use heartworm and parasite prevention year-round</li>
</ul>

<h3 style="font-size: 14px; color: #2563eb;">4.3 Prohibited Actions</h3>
<p>Guardian shall NOT:</p>
<ul>
<li>Spay/neuter the animal without Breeder's written consent</li>
<li>Breed the animal without Breeder's involvement</li>
<li>Relocate more than 50 miles from current address without Breeder approval</li>
</ul>

<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">ARTICLE V: BREEDING REQUIREMENTS</h2>

<p><strong>5.1 For Female Animals:</strong></p>
<ul>
<li>Maximum number of litters as agreed</li>
<li>Guardian must notify Breeder within 24 hours of heat cycle</li>
<li>Animal will stay with Breeder during whelping until puppies are weaned</li>
</ul>

<p><strong>5.2 For Male Animals:</strong></p>
<ul>
<li>Breeder retains rights to use the stud for their breeding program</li>
<li>Guardian must make animal available for approved breedings</li>
</ul>

<p><strong>5.3 Breeding Expenses:</strong> Breeder pays for health testing, breeding costs, prenatal care, whelping, and spay/neuter upon completion. Guardian pays for transportation and routine daily care.</p>

<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">ARTICLE VI: TRANSFER OF FULL OWNERSHIP</h2>

<div style="background: #d4edda; border: 1px solid #28a745; padding: 15px; margin: 20px 0; border-radius: 4px;">
<p style="margin: 0; font-weight: bold;">Full ownership transfers to Guardian upon:</p>
</div>

<ol>
<li>Completion of all breeding requirements</li>
<li>Completion of all required health testing</li>
<li>Animal has been spayed/neutered (at Breeder's expense)</li>
<li>Breeder provides written release and signs over registration</li>
</ol>

<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">ARTICLE VII: BREACH & TERMINATION</h2>

<p><strong>7.1 Guardian Breach:</strong> If Guardian fails to meet obligations, Breeder may demand immediate return of the animal or payment of full retail value.</p>

<p><strong>7.2 Dispute Resolution:</strong> Both parties agree to attempt resolution through direct communication, then non-binding mediation before any legal action.</p>

<p><strong>7.3 Governing Law:</strong> This Agreement is governed by the laws of the State of {{breeder.state}}.</p>

{{#if contract.additionalTerms}}
<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">ADDITIONAL TERMS</h2>
<div style="background: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 4px;">
{{contract.additionalTerms}}
</div>
{{/if}}

<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">SIGNATURES & ACKNOWLEDGMENT</h2>

<div style="background: #e8f4fd; border: 1px solid #2563eb; padding: 15px; margin: 20px 0; border-radius: 4px;">
<p style="margin: 0; font-size: 13px;"><strong>BY SIGNING BELOW</strong>, both parties acknowledge they have read and understand this Guardian Home Agreement. Guardian understands that Breeder retains ownership until all breeding obligations are complete.</p>
</div>

<div style="display: flex; gap: 40px; margin-top: 40px;">
<div style="flex: 1;">
<p style="font-weight: bold; margin-bottom: 5px;">BREEDER</p>
<div style="border-bottom: 1px solid #000; width: 100%; height: 50px; margin-bottom: 10px;"></div>
<p style="margin: 3px 0;">{{breeder.name}}</p>
<p style="margin: 3px 0;">{{breeder.businessName}}</p>
<p style="margin: 3px 0;">Date: _______________</p>
</div>
<div style="flex: 1;">
<p style="font-weight: bold; margin-bottom: 5px;">GUARDIAN</p>
<div style="border-bottom: 1px solid #000; width: 100%; height: 50px; margin-bottom: 10px;"></div>
<p style="margin: 3px 0;">{{buyer.name}}</p>
<p style="margin: 3px 0;">Date: _______________</p>
</div>
</div>

<div style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 11px; color: #666; text-align: center;">
<p>This guardian home agreement was prepared using BreederHQ Contract Management System</p>
<p>Agreement ID: {{contract.number}} | Generated: {{contract.date}}</p>
</div>

</div>
`;

const STUD_SERVICE_AGREEMENT_HTML = `
<div style="font-family: Georgia, 'Times New Roman', serif; max-width: 800px; margin: 0 auto; line-height: 1.6;">

<div style="text-align: center; margin-bottom: 30px;">
<h1 style="font-size: 24px; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 2px;">Stud Service Contract</h1>
<p style="font-size: 14px; color: #666;">Breeding Services Agreement</p>
<p style="font-size: 12px; margin-top: 15px;"><strong>Contract Number:</strong> {{contract.number}} &nbsp;&nbsp;|&nbsp;&nbsp; <strong>Date:</strong> {{contract.date}}</p>
</div>

<div style="background: #f8f9fa; border-left: 4px solid #2563eb; padding: 15px; margin-bottom: 25px;">
<p style="margin: 0; font-size: 13px;"><strong>This Stud Service Contract</strong> establishes the terms and conditions under which the Stud Owner agrees to provide breeding services for the female described herein.</p>
</div>

<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">ARTICLE I: PARTIES</h2>

<div style="display: flex; gap: 40px; margin: 20px 0;">
<div style="flex: 1;">
<p style="font-weight: bold; margin-bottom: 5px; color: #2563eb;">STUD OWNER</p>
<p style="margin: 3px 0;">{{breeder.businessName}}</p>
<p style="margin: 3px 0;">{{breeder.name}}</p>
<p style="margin: 3px 0;">{{breeder.address}}</p>
<p style="margin: 3px 0;">Phone: {{breeder.phone}}</p>
<p style="margin: 3px 0;">Email: {{breeder.email}}</p>
</div>
<div style="flex: 1;">
<p style="font-weight: bold; margin-bottom: 5px; color: #2563eb;">BITCH OWNER</p>
<p style="margin: 3px 0;">{{buyer.name}}</p>
<p style="margin: 3px 0;">{{buyer.address}}</p>
<p style="margin: 3px 0;">Phone: {{buyer.phone}}</p>
<p style="margin: 3px 0;">Email: {{buyer.email}}</p>
</div>
</div>

<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">ARTICLE II: STUD DOG INFORMATION</h2>

<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
<tr style="background: #e8f4fd;">
<td style="padding: 10px; border: 1px solid #ddd; width: 30%;"><strong>Registered Name:</strong></td>
<td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">{{animal.name}}</td>
</tr>
<tr style="background: #f8f9fa;">
<td style="padding: 10px; border: 1px solid #ddd;"><strong>Breed:</strong></td>
<td style="padding: 10px; border: 1px solid #ddd;">{{animal.breed}}</td>
</tr>
<tr>
<td style="padding: 10px; border: 1px solid #ddd;"><strong>Date of Birth:</strong></td>
<td style="padding: 10px; border: 1px solid #ddd;">{{animal.dateOfBirth}}</td>
</tr>
<tr style="background: #f8f9fa;">
<td style="padding: 10px; border: 1px solid #ddd;"><strong>Color:</strong></td>
<td style="padding: 10px; border: 1px solid #ddd;">{{animal.color}}</td>
</tr>
<tr>
<td style="padding: 10px; border: 1px solid #ddd;"><strong>Registration Number:</strong></td>
<td style="padding: 10px; border: 1px solid #ddd;">{{animal.registrationNumber}}</td>
</tr>
</table>

<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">ARTICLE III: STUD FEE & PAYMENT</h2>

<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
<tr style="background: #e8f4fd;">
<td style="padding: 12px; border: 1px solid #ddd; width: 40%;"><strong>Stud Fee:</strong></td>
<td style="padding: 12px; border: 1px solid #ddd; font-weight: bold; font-size: 18px;">{{transaction.totalPrice}}</td>
</tr>
{{#if transaction.depositAmount}}
<tr>
<td style="padding: 12px; border: 1px solid #ddd;"><strong>Booking Deposit (Non-Refundable):</strong></td>
<td style="padding: 12px; border: 1px solid #ddd;">{{transaction.depositAmount}}</td>
</tr>
<tr style="background: #f8f9fa;">
<td style="padding: 12px; border: 1px solid #ddd;"><strong>Balance Due:</strong></td>
<td style="padding: 12px; border: 1px solid #ddd;">{{transaction.balanceDue}}</td>
</tr>
{{/if}}
</table>

<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">ARTICLE IV: HEALTH REQUIREMENTS</h2>

<h3 style="font-size: 14px; color: #dc3545;">4.1 Bitch Health Certifications (Required)</h3>
<div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; margin: 15px 0; border-radius: 4px;">
<ul style="margin: 0; padding-left: 20px;">
<li><strong>Brucellosis Test:</strong> Negative test result within <strong>30 days</strong> of breeding (REQUIRED)</li>
<li><strong>Vaccinations:</strong> Current on DHPP and Rabies</li>
<li><strong>Parasites:</strong> Free of internal and external parasites</li>
<li><strong>Health Testing:</strong> Completed breed-appropriate health testing</li>
</ul>
</div>

<h3 style="font-size: 14px; color: #2563eb;">4.2 Stud Health Certifications</h3>
<p>Stud Owner certifies that the stud has tested negative for Brucellosis within the past 12 months, is current on vaccinations, and has completed breed-appropriate health testing.</p>

<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">ARTICLE V: REPEAT BREEDING GUARANTEE</h2>

<div style="background: #d4edda; border: 1px solid #28a745; padding: 15px; margin: 20px 0; border-radius: 4px;">
<p style="margin: 0; font-weight: bold;">If the bitch fails to conceive or produces no live puppies surviving to 48 hours, ONE free repeat breeding is offered under these conditions:</p>
</div>

<ol>
<li>Full stud fee was paid</li>
<li>All health requirements were met</li>
<li>Repeat breeding occurs within 12 months</li>
<li>Same bitch (not transferable)</li>
<li>Bitch passes health requirements again</li>
<li>Stud is still alive and available</li>
</ol>

<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">ARTICLE VI: NO GUARANTEES</h2>

<p><strong>6.1 No Litter Size Guarantee:</strong> Stud Owner makes NO guarantee regarding the number of puppies produced.</p>

<p><strong>6.2 No Puppy Quality Guarantee:</strong> Stud Owner makes no guarantee regarding color, markings, temperament, show quality, or health of offspring.</p>

<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">ARTICLE VII: LITTER REGISTRATION</h2>

<p>Upon confirmation of pregnancy AND payment of full stud fee, Stud Owner will provide all necessary documentation for litter registration within 14 days of receiving proper paperwork.</p>

{{#if contract.additionalTerms}}
<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">ADDITIONAL TERMS</h2>
<div style="background: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 4px;">
{{contract.additionalTerms}}
</div>
{{/if}}

<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">SIGNATURES & ACKNOWLEDGMENT</h2>

<div style="background: #e8f4fd; border: 1px solid #2563eb; padding: 15px; margin: 20px 0; border-radius: 4px;">
<p style="margin: 0; font-size: 13px;"><strong>BY SIGNING BELOW</strong>, both parties acknowledge they have read and understand this Stud Service Contract and certify that all health certifications provided are accurate.</p>
</div>

<div style="display: flex; gap: 40px; margin-top: 40px;">
<div style="flex: 1;">
<p style="font-weight: bold; margin-bottom: 5px;">STUD OWNER</p>
<div style="border-bottom: 1px solid #000; width: 100%; height: 50px; margin-bottom: 10px;"></div>
<p style="margin: 3px 0;">{{breeder.name}}</p>
<p style="margin: 3px 0;">{{breeder.businessName}}</p>
<p style="margin: 3px 0;">Date: _______________</p>
</div>
<div style="flex: 1;">
<p style="font-weight: bold; margin-bottom: 5px;">BITCH OWNER</p>
<div style="border-bottom: 1px solid #000; width: 100%; height: 50px; margin-bottom: 10px;"></div>
<p style="margin: 3px 0;">{{buyer.name}}</p>
<p style="margin: 3px 0;">Date: _______________</p>
</div>
</div>

<div style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 11px; color: #666; text-align: center;">
<p>This stud service contract was prepared using BreederHQ Contract Management System</p>
<p>Contract ID: {{contract.number}} | Generated: {{contract.date}}</p>
</div>

</div>
`;

const HEALTH_GUARANTEE_HTML = `
<div style="font-family: Georgia, 'Times New Roman', serif; max-width: 800px; margin: 0 auto; line-height: 1.6;">

<div style="text-align: center; margin-bottom: 30px;">
<h1 style="font-size: 24px; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 2px;">Health Guarantee Certificate</h1>
<p style="font-size: 14px; color: #666;">Limited Warranty on Animal Health</p>
<p style="font-size: 12px; margin-top: 15px;"><strong>Certificate Number:</strong> {{contract.number}} &nbsp;&nbsp;|&nbsp;&nbsp; <strong>Effective Date:</strong> {{contract.date}}</p>
</div>

<div style="background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin-bottom: 25px;">
<p style="margin: 0; font-size: 13px;"><strong>Health Commitment:</strong> {{breeder.businessName}} is committed to breeding healthy animals. This Health Guarantee Certificate provides warranty coverage for the animal described below.</p>
</div>

<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">ARTICLE I: PARTIES</h2>

<div style="display: flex; gap: 40px; margin: 20px 0;">
<div style="flex: 1;">
<p style="font-weight: bold; margin-bottom: 5px; color: #2563eb;">BREEDER/SELLER</p>
<p style="margin: 3px 0;">{{breeder.businessName}}</p>
<p style="margin: 3px 0;">{{breeder.name}}</p>
<p style="margin: 3px 0;">Phone: {{breeder.phone}}</p>
<p style="margin: 3px 0;">Email: {{breeder.email}}</p>
</div>
<div style="flex: 1;">
<p style="font-weight: bold; margin-bottom: 5px; color: #2563eb;">BUYER/OWNER</p>
<p style="margin: 3px 0;">{{buyer.name}}</p>
<p style="margin: 3px 0;">Email: {{buyer.email}}</p>
</div>
</div>

<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">ARTICLE II: ANIMAL INFORMATION</h2>

<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
<tr style="background: #e8f4fd;">
<td style="padding: 10px; border: 1px solid #ddd; width: 30%;"><strong>Name:</strong></td>
<td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">{{animal.name}}</td>
</tr>
<tr>
<td style="padding: 10px; border: 1px solid #ddd;"><strong>Breed:</strong></td>
<td style="padding: 10px; border: 1px solid #ddd;">{{animal.breed}}</td>
</tr>
<tr style="background: #f8f9fa;">
<td style="padding: 10px; border: 1px solid #ddd;"><strong>Date of Birth:</strong></td>
<td style="padding: 10px; border: 1px solid #ddd;">{{animal.dateOfBirth}}</td>
</tr>
<tr>
<td style="padding: 10px; border: 1px solid #ddd;"><strong>Sex:</strong></td>
<td style="padding: 10px; border: 1px solid #ddd;">{{animal.sex}}</td>
</tr>
<tr style="background: #f8f9fa;">
<td style="padding: 10px; border: 1px solid #ddd;"><strong>Color:</strong></td>
<td style="padding: 10px; border: 1px solid #ddd;">{{animal.color}}</td>
</tr>
{{#if animal.microchipNumber}}
<tr>
<td style="padding: 10px; border: 1px solid #ddd;"><strong>Microchip Number:</strong></td>
<td style="padding: 10px; border: 1px solid #ddd;">{{animal.microchipNumber}}</td>
</tr>
{{/if}}
</table>

<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
<tr style="background: #e8f4fd;">
<td style="padding: 12px; border: 1px solid #ddd; width: 40%;"><strong>Purchase Date:</strong></td>
<td style="padding: 12px; border: 1px solid #ddd;">{{transaction.depositDate}}</td>
</tr>
<tr>
<td style="padding: 12px; border: 1px solid #ddd;"><strong>Purchase Price:</strong></td>
<td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">{{transaction.totalPrice}}</td>
</tr>
</table>

<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">ARTICLE III: GUARANTEE COVERAGE</h2>

<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
<tr style="background: #2563eb; color: white;">
<th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Coverage Type</th>
<th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Duration</th>
</tr>
<tr style="background: #f8f9fa;">
<td style="padding: 10px; border: 1px solid #ddd;"><strong>Initial Health Examination</strong></td>
<td style="padding: 10px; border: 1px solid #ddd;">72 Hours</td>
</tr>
<tr>
<td style="padding: 10px; border: 1px solid #ddd;"><strong>Genetic/Hereditary Conditions</strong></td>
<td style="padding: 10px; border: 1px solid #ddd;">2 Years</td>
</tr>
</table>

<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">ARTICLE IV: INITIAL HEALTH GUARANTEE (72 HOURS)</h2>

<div style="background: #fff3cd; border: 1px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
<p style="margin: 0; font-weight: bold;">Buyer MUST have the animal examined by a licensed veterinarian within 72 hours of pickup.</p>
</div>

<p>If the veterinarian determines the animal has a serious illness or congenital defect that existed prior to sale, Buyer may:</p>
<ul>
<li><strong>Option A:</strong> Return the animal for a full refund</li>
<li><strong>Option B:</strong> Keep the animal and receive reimbursement for treatment up to the purchase price</li>
</ul>

<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">ARTICLE V: GENETIC HEALTH GUARANTEE (2 YEARS)</h2>

<p>This guarantee covers debilitating genetic or hereditary defects for two (2) years from birth, including:</p>
<ul>
<li>Severe hip dysplasia requiring surgery</li>
<li>Congenital heart defects</li>
<li>Hereditary blindness (PRA, cataracts)</li>
<li>Severe luxating patella (Grade III-IV)</li>
</ul>

<p>If a covered genetic condition is confirmed by a board-certified specialist:</p>
<ul>
<li><strong>Option A:</strong> Return the animal for a replacement of equal value</li>
<li><strong>Option B:</strong> Keep the animal and receive 50% of purchase price toward treatment</li>
</ul>

<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">ARTICLE VI: CONDITIONS & EXCLUSIONS</h2>

<h3 style="font-size: 14px; color: #dc3545;">6.1 Guarantee is VOID if:</h3>
<ul>
<li>Animal is not fed a high-quality diet</li>
<li>Animal does not receive timely vaccinations and veterinary care</li>
<li>Animal is bred without written consent (for limited registration)</li>
<li>Animal is subjected to abuse, neglect, or hazardous conditions</li>
<li>Animal is spayed/neutered before 12 months (unless medically necessary)</li>
<li>Injury results from accident, poisoning, or owner negligence</li>
</ul>

<h3 style="font-size: 14px; color: #2563eb;">6.2 Exclusions:</h3>
<p>This guarantee does NOT cover: hypoglycemia, parasites, coccidia, giardia, kennel cough, allergies, skin conditions, umbilical hernias under 1 inch, cherry eye, elongated soft palate, stenotic nares, behavioral issues, or conditions resulting from improper care.</p>

<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">ARTICLE VII: CLAIM PROCESS</h2>

<ol>
<li>Notify Breeder within 48 hours of diagnosis</li>
<li>Provide complete veterinary records and diagnosis</li>
<li>For genetic claims: provide specialist examination report</li>
<li>Allow Breeder 14 days to review and respond</li>
</ol>

<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">ARTICLE VIII: LIMITATION OF LIABILITY</h2>

<p>Breeder's maximum liability shall not exceed the original purchase price. Breeder is NOT liable for consequential damages including veterinary expenses beyond those covered, boarding costs, lost wages, or emotional distress.</p>

<p>This guarantee is NOT transferable to subsequent owners.</p>

{{#if contract.additionalTerms}}
<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">ADDITIONAL TERMS</h2>
<div style="background: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 4px;">
{{contract.additionalTerms}}
</div>
{{/if}}

<h2 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-top: 30px;">SIGNATURES & ACKNOWLEDGMENT</h2>

<div style="background: #e8f4fd; border: 1px solid #2563eb; padding: 15px; margin: 20px 0; border-radius: 4px;">
<p style="margin: 0; font-size: 13px;"><strong>BY SIGNING BELOW</strong>, Buyer acknowledges they have read and understand this Health Guarantee, including all conditions, exclusions, and limitations.</p>
</div>

<div style="display: flex; gap: 40px; margin-top: 40px;">
<div style="flex: 1;">
<p style="font-weight: bold; margin-bottom: 5px;">BUYER/OWNER</p>
<div style="border-bottom: 1px solid #000; width: 100%; height: 50px; margin-bottom: 10px;"></div>
<p style="margin: 3px 0;">{{buyer.name}}</p>
<p style="margin: 3px 0;">Date: _______________</p>
</div>
<div style="flex: 1;">
<p style="font-weight: bold; margin-bottom: 5px;">BREEDER/SELLER</p>
<div style="border-bottom: 1px solid #000; width: 100%; height: 50px; margin-bottom: 10px;"></div>
<p style="margin: 3px 0;">{{breeder.name}}</p>
<p style="margin: 3px 0;">{{breeder.businessName}}</p>
<p style="margin: 3px 0;">Date: _______________</p>
</div>
</div>

<div style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 11px; color: #666; text-align: center;">
<p>This health guarantee certificate was prepared using BreederHQ Contract Management System</p>
<p>Certificate ID: {{contract.number}} | Generated: {{contract.date}}</p>
</div>

</div>
`;

// ────────────────────────────────────────────────────────────────────────────
// Template Definitions
// ────────────────────────────────────────────────────────────────────────────

const SYSTEM_TEMPLATES: ContractTemplateSeed[] = [
  {
    slug: "sales-agreement",
    name: "Animal Sales Agreement",
    description:
      "Comprehensive sales contract with built-in health guarantee, spay/neuter terms, return policy, registration transfer, and dispute resolution. Professional legal formatting.",
    category: ContractTemplateCategory.SALES_AGREEMENT,
    bodyHtml: SALES_AGREEMENT_HTML,
    mergeFields: [
      "breeder.name",
      "breeder.businessName",
      "breeder.address",
      "breeder.phone",
      "breeder.email",
      "breeder.website",
      "breeder.state",
      "buyer.name",
      "buyer.address",
      "buyer.phone",
      "buyer.email",
      "animal.name",
      "animal.breed",
      "animal.dateOfBirth",
      "animal.sex",
      "animal.color",
      "animal.registrationNumber",
      "animal.registrationOrg",
      "animal.microchipNumber",
      "animal.sire",
      "animal.dam",
      "transaction.totalPrice",
      "transaction.depositAmount",
      "transaction.depositDate",
      "transaction.balanceDue",
      "transaction.paymentTerms",
      "transaction.pickupDate",
      "transaction.deliveryMethod",
      "contract.number",
      "contract.date",
      "contract.saleType",
      "contract.additionalTerms",
    ],
  },
  {
    slug: "deposit-agreement",
    name: "Deposit Agreement",
    description:
      "Complete reservation contract with detailed refund policies, deposit transfer options, timeline tracking, and buyer/seller obligations.",
    category: ContractTemplateCategory.DEPOSIT_AGREEMENT,
    bodyHtml: DEPOSIT_AGREEMENT_HTML,
    mergeFields: [
      "breeder.name",
      "breeder.businessName",
      "breeder.address",
      "breeder.phone",
      "breeder.email",
      "breeder.state",
      "buyer.name",
      "buyer.address",
      "buyer.phone",
      "buyer.email",
      "animal.name",
      "animal.breed",
      "offspring.name",
      "offspring.collarColor",
      "offspring.sex",
      "offspring.dateOfBirth",
      "transaction.depositAmount",
      "transaction.totalPrice",
      "transaction.balanceDue",
      "transaction.pickupDate",
      "contract.number",
      "contract.date",
      "contract.pickPosition",
      "contract.additionalTerms",
    ],
  },
  {
    slug: "co-ownership-agreement",
    name: "Co-Ownership Agreement",
    description:
      "Detailed shared ownership contract covering ownership percentages, breeding rights, litter distribution, show rights, health testing requirements, and transfer conditions.",
    category: ContractTemplateCategory.CO_OWNERSHIP,
    bodyHtml: CO_OWNERSHIP_AGREEMENT_HTML,
    mergeFields: [
      "breeder.name",
      "breeder.businessName",
      "breeder.address",
      "breeder.phone",
      "breeder.email",
      "breeder.state",
      "buyer.name",
      "buyer.address",
      "buyer.phone",
      "buyer.email",
      "animal.name",
      "animal.breed",
      "animal.dateOfBirth",
      "animal.sex",
      "animal.color",
      "animal.registrationNumber",
      "animal.microchipNumber",
      "transaction.totalPrice",
      "transaction.depositAmount",
      "contract.number",
      "contract.date",
      "contract.additionalTerms",
    ],
  },
  {
    slug: "guardian-home-agreement",
    name: "Guardian Home Agreement",
    description:
      "Comprehensive guardian program contract with detailed care requirements, breeding obligations, expense allocation, communication requirements, and ownership transfer conditions.",
    category: ContractTemplateCategory.GUARDIAN_HOME,
    bodyHtml: GUARDIAN_HOME_AGREEMENT_HTML,
    mergeFields: [
      "breeder.name",
      "breeder.businessName",
      "breeder.address",
      "breeder.phone",
      "breeder.email",
      "breeder.state",
      "buyer.name",
      "buyer.address",
      "buyer.phone",
      "buyer.email",
      "animal.name",
      "animal.breed",
      "animal.dateOfBirth",
      "animal.sex",
      "animal.color",
      "animal.registrationNumber",
      "animal.microchipNumber",
      "transaction.totalPrice",
      "contract.number",
      "contract.date",
      "contract.additionalTerms",
    ],
  },
  {
    slug: "stud-service-contract",
    name: "Stud Service Contract",
    description:
      "Professional stud service agreement with comprehensive health requirements, breeding methods, repeat breeding guarantee, and litter registration terms.",
    category: ContractTemplateCategory.STUD_SERVICE,
    bodyHtml: STUD_SERVICE_AGREEMENT_HTML,
    mergeFields: [
      "breeder.name",
      "breeder.businessName",
      "breeder.address",
      "breeder.phone",
      "breeder.email",
      "breeder.state",
      "buyer.name",
      "buyer.address",
      "buyer.phone",
      "buyer.email",
      "animal.name",
      "animal.breed",
      "animal.dateOfBirth",
      "animal.color",
      "animal.registrationNumber",
      "transaction.totalPrice",
      "transaction.depositAmount",
      "transaction.balanceDue",
      "contract.number",
      "contract.date",
      "contract.additionalTerms",
    ],
  },
  {
    slug: "health-guarantee",
    name: "Health Guarantee",
    description:
      "Comprehensive health warranty covering 72-hour examination, genetic/hereditary conditions, detailed coverage tables, exclusions, claim process, and limitation of liability.",
    category: ContractTemplateCategory.HEALTH_GUARANTEE,
    bodyHtml: HEALTH_GUARANTEE_HTML,
    mergeFields: [
      "breeder.name",
      "breeder.businessName",
      "breeder.phone",
      "breeder.email",
      "buyer.name",
      "buyer.email",
      "animal.name",
      "animal.breed",
      "animal.dateOfBirth",
      "animal.sex",
      "animal.color",
      "animal.microchipNumber",
      "transaction.totalPrice",
      "transaction.depositDate",
      "contract.number",
      "contract.date",
      "contract.additionalTerms",
    ],
  },
];

// ────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Seeding system contract templates...\n");

  for (const template of SYSTEM_TEMPLATES) {
    const result = await prisma.contractTemplate.upsert({
      where: { slug: template.slug },
      update: {
        name: template.name,
        description: template.description,
        category: template.category,
        bodyHtml: template.bodyHtml,
        mergeFields: template.mergeFields,
        version: { increment: 1 },
      },
      create: {
        slug: template.slug,
        name: template.name,
        description: template.description,
        type: ContractTemplateType.SYSTEM,
        category: template.category,
        bodyHtml: template.bodyHtml,
        mergeFields: template.mergeFields,
        version: 1,
      },
    });

    console.log(`✓ Upserted template: ${result.name} (${result.slug}) v${result.version}`);
  }

  const totalCount = await prisma.contractTemplate.count({
    where: { type: ContractTemplateType.SYSTEM },
  });

  console.log(`\nDone. Total system templates: ${totalCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
