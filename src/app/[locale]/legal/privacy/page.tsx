import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Folio · Politique de confidentialité",
};

const SUPPORT_EMAIL = "mt.bui.fr@gmail.com";
const UPDATED = "14 septembre 2026";

/**
 * Privacy policy for the Folio apps (web, iOS, Android). Plain static content:
 * the stores only need a reachable, honest description of what the app does
 * with personal data. Bump UPDATED when the text changes.
 */
export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return locale === "en" ? <English /> : <French />;
}

function French() {
  return (
    <>
      <h1>Politique de confidentialité</h1>
      <p>Dernière mise à jour : {UPDATED}</p>
      <p>
        Folio est une application de suivi de chantier (factures, documents,
        photos, main-d&apos;œuvre, chiffrage) éditée par Flowitup. Cette page
        décrit les données traitées par l&apos;application web et les
        applications mobiles Folio, et vos droits.
      </p>
      <h2>Données traitées</h2>
      <ul>
        <li>
          <strong>Compte</strong> : numéro de téléphone (identifiant de
          connexion, codes SMS à usage unique), nom, rôle dans l&apos;entreprise
          ou le projet.
        </li>
        <li>
          <strong>Contenu que vous ajoutez</strong> : projets, factures et leurs
          pièces jointes, documents, photos de chantier, notes, temps de
          travail, devis et prix fournisseurs.
        </li>
        <li>
          <strong>Technique</strong> : jetons de session, jeton de notification
          push de l&apos;appareil (si vous activez les notifications), journaux
          serveur (horodatage, adresse IP, requêtes) conservés à des fins de
          sécurité et de diagnostic.
        </li>
      </ul>
      <p>
        L&apos;appareil photo et la photothèque ne sont utilisés que lorsque
        vous choisissez d&apos;attacher une image ; aucune donnée de
        localisation n&apos;est collectée.
      </p>
      <h2>Finalités et base légale</h2>
      <p>
        Les données servent uniquement à fournir le service : authentification,
        partage des informations de chantier entre les membres d&apos;un même
        projet ou d&apos;une même entreprise, notifications que vous avez
        demandées, sécurité et support. Le traitement repose sur
        l&apos;exécution du contrat d&apos;utilisation (art. 6.1.b RGPD) et sur
        notre intérêt légitime à sécuriser le service (art. 6.1.f).
      </p>
      <h2>Partage</h2>
      <p>
        Vos données sont visibles des autres membres des projets et entreprises
        auxquels vous appartenez, selon leur rôle. Nous ne vendons aucune donnée
        et n&apos;affichons aucune publicité. Nous utilisons des sous-traitants
        techniques pour l&apos;hébergement (Google Cloud, Union européenne),
        l&apos;envoi de SMS et d&apos;e-mails, et les notifications push (Expo,
        Apple, Google), chacun limité à sa fonction.
      </p>
      <h2>Conservation</h2>
      <p>
        Les données du compte et des projets sont conservées tant que le compte
        est actif, puis supprimées ou anonymisées dans un délai de 90 jours
        après la suppression du compte. Les codes SMS expirent en quelques
        minutes. Les journaux techniques sont conservés au plus 12 mois.
      </p>
      <h2>Vos droits</h2>
      <p>
        Vous pouvez demander l&apos;accès, la rectification, la portabilité ou
        la suppression de vos données, ou la suppression de votre compte, en
        écrivant à <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. Vous
        pouvez aussi saisir la CNIL.
      </p>
      <h2>Sécurité</h2>
      <p>
        Les échanges sont chiffrés (HTTPS), les codes de connexion sont stockés
        hachés, et l&apos;accès aux données est restreint par projet et par
        entreprise.
      </p>
      <h2>Contact</h2>
      <p>
        Flowitup — <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>
    </>
  );
}

function English() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p>Last updated: {UPDATED}</p>
      <p>
        Folio is a construction-site tracking app (invoices, documents, photos,
        labor, cost planning) published by Flowitup. This page describes the
        data processed by the Folio web and mobile apps and your rights.
      </p>
      <h2>Data we process</h2>
      <ul>
        <li>
          <strong>Account</strong>: phone number (sign-in identifier, one-time
          SMS codes), name, role in the company or project.
        </li>
        <li>
          <strong>Content you add</strong>: projects, invoices and their
          attachments, documents, site photos, notes, labor time, quotes and
          supplier prices.
        </li>
        <li>
          <strong>Technical</strong>: session tokens, the device
          push-notification token (if you enable notifications), server logs
          (timestamp, IP address, requests) kept for security and diagnostics.
        </li>
      </ul>
      <p>
        The camera and photo library are used only when you choose to attach an
        image; no location data is collected.
      </p>
      <h2>Purposes and legal basis</h2>
      <p>
        Data is used solely to provide the service: authentication, sharing site
        information between members of the same project or company,
        notifications you asked for, security and support. Processing relies on
        the performance of the terms of use (GDPR art. 6.1.b) and on our
        legitimate interest in securing the service (art. 6.1.f).
      </p>
      <h2>Sharing</h2>
      <p>
        Your data is visible to other members of the projects and companies you
        belong to, according to their role. We do not sell data and show no
        advertising. We rely on technical processors for hosting (Google Cloud,
        European Union), SMS and e-mail delivery, and push notifications (Expo,
        Apple, Google), each limited to its function.
      </p>
      <h2>Retention</h2>
      <p>
        Account and project data is kept while the account is active, then
        deleted or anonymised within 90 days of account deletion. SMS codes
        expire within minutes. Technical logs are kept for at most 12 months.
      </p>
      <h2>Your rights</h2>
      <p>
        You can request access, rectification, portability or deletion of your
        data, or deletion of your account, by writing to{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. You may also
        lodge a complaint with the CNIL (French data protection authority).
      </p>
      <h2>Security</h2>
      <p>
        Traffic is encrypted (HTTPS), sign-in codes are stored hashed, and data
        access is restricted per project and per company.
      </p>
      <h2>Contact</h2>
      <p>
        Flowitup — <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>
    </>
  );
}
