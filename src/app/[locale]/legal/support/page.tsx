import type { Metadata } from "next";

export const metadata: Metadata = { title: "Folio · Support" };

const SUPPORT_EMAIL = "mt.bui.fr@gmail.com";

/** Support page linked from the App Store / Play listings. */
export default async function SupportPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const fr = locale !== "en";
  return (
    <>
      <h1>{fr ? "Support Folio" : "Folio Support"}</h1>
      <p>
        {fr
          ? "Une question, un problème de connexion ou une demande de suppression de compte ? Écrivez-nous :"
          : "A question, a sign-in problem or an account deletion request? Write to us:"}
      </p>
      <p>
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>
      <p>
        {fr
          ? "Précisez le numéro de téléphone de votre compte et, si possible, une capture d'écran. Réponse sous 2 jours ouvrés."
          : "Include the phone number of your account and, if possible, a screenshot. We answer within 2 business days."}
      </p>
      <p>
        <a href={`/${locale}/legal/privacy`}>
          {fr ? "Politique de confidentialité" : "Privacy policy"}
        </a>
      </p>
    </>
  );
}
