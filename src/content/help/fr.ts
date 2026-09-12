import type { HelpCatalogue, HelpChrome } from "./types";

/**
 * Le guide des processus de l'application web, en français — la langue de production de Folio.
 * Traduit de en.ts : mêmes sujets, dans le même ordre, avec le même nombre d'étapes. Chaque
 * étape nomme un bouton, un onglet ou une entrée de menu avec le libellé exact de l'interface
 * française (src/messages/fr.json).
 */
export const helpCatalogueFr: HelpCatalogue = [
  {
    id: "getting-started",
    title: "Se connecter et rejoindre une entreprise",
    purpose:
      "Folio vous connecte avec votre numéro de téléphone et un code reçu par SMS — il n'y a pas de mot de passe. Votre compte doit ensuite appartenir à une entreprise pour voir quoi que ce soit.",
    steps: [
      "Saisissez votre numéro de téléphone sur la page de connexion et demandez le code.",
      "Tapez le code reçu par SMS pour terminer la connexion.",
      "Si votre compte n'appartient encore à aucune entreprise, Folio vous envoie sur une courte page de démarrage.",
      "Là, choisissez “Créer une entreprise” — vous en devenez l'administrateur — ou “Saisir un code d'adhésion” pour rejoindre une entreprise existante avec le code que son administrateur vous a donné.",
      "Si vous avez été invité par e-mail, le lien contenu dans le message vous rattache directement.",
    ],
    gotchas: [
      "Seuls les numéros français sont acceptés, et sans le 0 initial.",
    ],
    whoCanDoIt:
      "Toute personne dont le numéro de téléphone a été ajouté à une entreprise.",
  },
  {
    id: "navigation",
    title: "Se repérer dans l'application",
    purpose:
      "Un seul projet est sélectionné à la fois, et presque toute l'application parle de ce projet. Le menu latéral regroupe les sections du projet ; la barre du haut porte les actions.",
    steps: [
      "Choisissez le chantier actif dans le sélecteur de projet, en haut du menu latéral. Sur écran étroit, il se trouve dans la barre du haut.",
      "Le premier groupe du menu latéral vaut pour toute l'application : “Aperçu”, “Projets” et “Bibliothèque”.",
      "Une fois un projet sélectionné, le menu latéral déploie ses sections : “Planification”, “Main-d'œuvre”, “Dépenses”, “Chiffrage”, “Membres”, “Notes”, “Documents” et “Analyses”.",
      "Les administrateurs d'entreprise voient en plus un groupe “Facturation” : “Devis”, “Factures”, “Modèles” et “Remboursables”.",
      "La barre du haut porte l'action principale de la page, le point d'aide, la cloche, le bouton de thème clair ou sombre, le choix de la langue et le menu de votre compte.",
    ],
    whoCanDoIt:
      "Tout le monde voit le groupe général. “Documents” n'apparaît que si vous avez le droit de l'ouvrir, et “Facturation” seulement pour les administrateurs d'entreprise.",
    gotchas: [
      "Le bouton d'action de la barre du haut change selon la page, et il disparaît entièrement si vous n'avez pas le droit correspondant : si vous attendiez “Nouvelle dépense” ou “Enregistrer jour” et qu'il n'y est pas, c'est une permission, pas un bug.",
    ],
  },
  {
    id: "dashboard",
    title: "L'aperçu du projet",
    purpose:
      "Une photo en lecture seule du chantier sélectionné : ce qui a été dépensé ce mois-ci, où en est le déblocage du crédit bancaire, les dépenses par type sur six mois, et les tâches de la semaine.",
    steps: [
      "Sélectionnez d'abord un projet — sans projet sélectionné, les panneaux restent vides.",
      "Lisez “Dépensé ce mois-ci” et la part du budget que cela représente.",
      "Lisez le graphique “Déblocage du crédit bancaire”. Si aucun crédit n'est enregistré, il propose à la place “Ouvrir les paramètres du projet”.",
      "Utilisez “Dépenses mensuelles par type” pour voir où est passé l'argent, et “Dépenses” pour basculer dans le registre.",
      "Lisez “Cette semaine” pour les tâches à échéance, celles en retard portant la mention “En retard”, et “Agenda” pour ouvrir la planification.",
    ],
    whoCanDoIt:
      "Toute personne connectée. La partie financière — le graphique du crédit bancaire et les montants rapportés au budget — demande le droit “Voir le budget et les fonds débloqués” ; sans lui, elle n'est tout simplement pas affichée.",
    gotchas: [
      "“Aperçu” est volontairement en lecture seule et n'a pas de bouton d'action propre.",
    ],
  },
  {
    id: "projects",
    title: "Les projets et leurs paramètres",
    purpose:
      "Tous les chantiers auxquels vous avez accès, avec leur crédit et leurs dépenses, leur équipe, et les formulaires pour en créer, en modifier ou en supprimer un.",
    steps: [
      "Filtrez la liste avec le sélecteur “Tous les projets” / “Actifs”, ou cherchez par nom.",
      "Cliquez sur “Nouveau projet”, puis donnez-lui un nom — obligatoire — et, si vous le souhaitez, une adresse, un crédit total et une source de financement. Si vous administrez plusieurs entreprises, choisissez celle à laquelle il appartient.",
      "Sur la carte d'un projet, le menu d'actions propose “Modifier le projet” et “Supprimer le projet”. La suppression vous demande de taper le texte de confirmation affiché en gras.",
      "“Afficher l'équipe” déplie la liste des membres ; “Inviter” ajoute quelqu'un, et l'icône corbeille de la ligne le retire.",
      "“Ouvrir le tableau de bord” sélectionne le projet et ouvre son aperçu ; “Médias” ouvre ses photos.",
      "Sur la page des paramètres du projet, renseignez le crédit bancaire et la source de financement, ainsi que le préfixe de numéro de facture, puis enregistrez.",
    ],
    whoCanDoIt:
      "Créer un projet demande d'être administrateur de l'entreprise. Le modifier demande le droit “Modifier le projet”, et le supprimer est réservé aux administrateurs. Inviter et retirer des membres demande le droit “Gérer les membres”. Les colonnes de crédit et de restant demandent le droit “Voir le budget et les fonds débloqués”.",
    gotchas: [
      "La page des paramètres du projet est difficile à atteindre : son seul lien est “Ouvrir les paramètres du projet”, dans le graphique du crédit bancaire, et ce lien disparaît dès qu'un crédit est enregistré.",
      "Qui ne peut pas créer de projet et n'en a aucun d'assigné voit le message “En attente d'affectation” plutôt qu'une invitation à en créer un.",
    ],
  },
  {
    id: "planning",
    title: "Les tâches et la planification",
    purpose:
      "Le tableau des tâches de l'équipe pour un chantier : un tableau Kanban avec un backlog, plus une vue semaine organisée par échéance.",
    steps: [
      "Basculez entre “Tableau” et “Semaine” avec le sélecteur en haut de la page.",
      "Sur le tableau, travaillez avec la bande “Backlog” et les colonnes “À faire”, “En cours”, “Bloqué” et “Terminé”.",
      "Cliquez sur “Ajouter une tâche” dans une colonne pour en créer une à cet endroit : un titre, une description, une priorité, une échéance et des étiquettes séparées par des virgules.",
      "Glissez une carte d'une colonne à l'autre pour changer son statut.",
      "Cliquez sur une carte pour ouvrir son panneau de détail, la modifier sur place, ou la supprimer.",
      "Dans la vue semaine, passez d'une semaine à l'autre et utilisez le “+” d'un jour pour créer une tâche à échéance ce jour-là, ou celui de “Non planifié” pour une tâche sans date.",
    ],
    whoCanDoIt:
      "Toute personne qui peut ouvrir le projet. La planification n'a aucune barrière de permission — chacun peut créer, déplacer, modifier et supprimer des tâches.",
    gotchas: [
      "La suppression d'une tâche est immédiate et sans retour en arrière : il n'y a qu'une confirmation du navigateur.",
    ],
  },
  {
    id: "labor",
    title: "Pointage, ouvriers et paie",
    purpose:
      "Qui était sur le chantier, quels jours, à quel tarif journalier, ce que cela coûte, et ce qui a réellement été payé à chaque ouvrier.",
    steps: [
      "Choisissez un onglet : “Résumé”, “Présence”, “Ouvriers” ou “Paiements”.",
      "Dans “Ouvriers”, cliquez sur “Ajouter ouvrier” et renseignez le nom, le téléphone, le rôle et le tarif journalier. Chaque ligne peut ensuite être modifiée, désactivée, ou recevoir un changement de tarif.",
      "“Ajuster le tarif” prend un nouveau tarif journalier et sa date d'effet ; l'historique en dessous liste et supprime les changements programmés.",
      "Dans “Présence”, cliquez sur “Enregistrer jour”, choisissez la date, puis cochez tous ceux qui étaient présents — en reprenant au besoin la journée précédente, et, par ouvrier, un tarif personnalisé, une note et un supplément.",
      "Les journées qu'un ouvrier a pointées lui-même arrivent “En attente de validation” et restent non chiffrées tant que vous n'avez pas utilisé “Valider” ou “Refuser”.",
      "Exportez le pointage d'un ouvrier ou de toute l'équipe, sur une plage de mois, en xlsx ou en pdf.",
      "Dans “Paiements”, comparez ce qui est dû à chaque ouvrier et ce qui lui a été payé, enregistrez un paiement, ou attribuez une dépense de main-d'œuvre à laquelle aucun ouvrier n'est rattaché.",
    ],
    whoCanDoIt:
      "Pointer les journées, modifier les entrées et valider demandent le droit “Gérer la main-d'œuvre”. Enregistrer un paiement demande le droit “Gérer les factures”. Qui n'a aucun des deux voit uniquement “Présences du jour” — noms, statut, heures et type de journée, et aucun montant.",
    gotchas: [
      "Réenregistrer une journée qu'un ouvrier a déjà pointée est refusé : validez plutôt son entrée en attente.",
    ],
  },
  {
    id: "invoices",
    title: "Le registre des dépenses",
    purpose:
      "Chaque euro qui entre et sort d'un chantier — achats fournisseurs, paiements de main-d'œuvre, fonds débloqués par la banque et avoirs — avec les pièces jointes, la surbrillance et l'export.",
    steps: [
      "Lisez le résumé des deux caisses — entreprise et personnelle — et le graphique du crédit bancaire en haut de la page.",
      "Filtrez avec les onglets de type : “Toutes”, “Fond débloqué”, “Main-d'œuvre”, “Achats & prestations”, “Autres” ou “Avoir”.",
      "Cliquez sur “Nouvelle dépense” et indiquez le type, la date d'émission, le destinataire — pour la main-d'œuvre, il devient un sélecteur d'ouvrier —, le moyen de paiement et d'éventuelles notes.",
      "Ajoutez les lignes avec une description, une quantité, un prix unitaire et un taux de TVA, puis enregistrez.",
      "Pour un avoir, choisissez la dépense “Achats & prestations” qu'il rembourse, dites s'il a été réglé en espèces ou sous forme d'avoir fournisseur, et dans ce dernier cas sur quelle facture il est imputé.",
      "Cliquez sur une ligne pour la déplier : imprimez ou enregistrez le PDF, modifiez-la, supprimez-la, ou glissez-y des pièces jointes.",
      "Exportez une plage de mois, filtrée par type, en xlsx ou en pdf ; et donnez aux lignes une couleur de surbrillance pour les regrouper à l'œil.",
    ],
    whoCanDoIt:
      "Toute personne sur le projet peut lire la liste et l'exporter. Modifier, supprimer, surligner et tout ce qui se trouve dans une ligne dépliée demande le droit “Gérer les factures”. Sans le droit “Voir le budget et les fonds débloqués”, les caisses et le graphique bancaire sont masqués et l'onglet des fonds débloqués disparaît.",
    gotchas: [
      "Une écriture de fonds débloqués marquée “Avance en espèces de l'entreprise” n'est volontairement pas comptée dans les fonds débloqués. Ce que vous achetez ensuite avec ces espèces doit être enregistré sous votre propre moyen de paiement, sinon c'est compté deux fois.",
      "Les lignes que Folio a générées lui-même ne peuvent jamais être modifiées ni supprimées.",
    ],
  },
  {
    id: "chiffrage",
    title: "Le chiffrage",
    purpose:
      "Préparez ce qu'il faut acheter pour le chantier — des postes d'articles avec leurs quantités —, enregistrez le prix de chaque magasin article par article, et obtenez le budget à prévoir.",
    steps: [
      "Cliquez sur “Nouveau poste” et nommez-le d'après un corps de métier ou une zone, par exemple “Lumière” ou “Plomberie”.",
      "Dans un poste, ajoutez un article avec un nom, une quantité, une unité et une pièce.",
      "Sur un article, ajoutez un prix : choisissez le magasin — ou tapez un nom pour le créer au passage —, puis le prix unitaire, la base du prix HT ou TTC, le taux de TVA et, si vous le voulez, un lien produit.",
      "Dépliez un article pour comparer les prix que vous avez collectés ; chacun porte le badge “Retenu”, “Moins cher” ou “Auto · moins cher”. “Retenir” fixe le prix utilisé par le budget.",
      "Utilisez “Comparer” sur un poste pour mettre deux magasins face à face et lire l'écart par article et par panier.",
      "Lisez la carte des totaux pour le budget à prévoir, HT et TTC, avec un avertissement tant que des articles n'ont pas de prix.",
    ],
    whoCanDoIt:
      "Toute personne qui peut ouvrir le projet peut le lire et utiliser la comparaison. Créer et modifier les postes, les articles et les prix demande le droit “Gérer les factures” ; sans lui, la page est en lecture seule.",
    gotchas: [
      "Les magasins n'ont qu'un nom : rien ne permet d'enregistrer ou de modifier l'adresse ou le site web d'un magasin, ni d'en supprimer un.",
      "Les prix sont comparés par magasin : choisissez toujours le même magasin, sinon la comparaison se casse sans rien dire.",
    ],
  },
  {
    id: "members",
    title: "Qui travaille sur ce projet",
    purpose:
      "Qui est sur ce chantier et comment il y est arrivé : assignez des personnes déjà dans l'entreprise, invitez-en de nouvelles par e-mail, et retirez-les.",
    steps: [
      "Cliquez sur “Assigner un membre”, cherchez dans l'annuaire de l'entreprise par nom ou par téléphone, choisissez le rôle, et assignez.",
      "Cliquez sur “Inviter un membre” pour envoyer une invitation par e-mail. Un compte Folio existant est ajouté immédiatement ; sinon, la personne reçoit un lien valable sept jours.",
      "Lisez le tableau des membres : nom, e-mail et date d'arrivée.",
      "Utilisez “Modifier” sur une ligne pour corriger un nom affiché ou un e-mail, ou “Retirer” pour sortir quelqu'un du projet.",
      "Sous “Invitations en attente”, voyez qui n'a pas encore accepté et révoquez une invitation si nécessaire.",
    ],
    whoCanDoIt:
      "Assigner demande le droit “Modifier le projet”, inviter et révoquer demandent le droit “Inviter des membres”, et modifier ou retirer demande le droit “Gérer les membres”. Seul un administrateur d'entreprise peut attribuer le rôle “Manager” ; un manager ne peut assigner que “Membre”.",
    gotchas: [
      "Le rôle sur le projet ne se modifie pas depuis “Modifier le membre” — les rôles s'attribuent et se changent par “Assigner un membre”.",
    ],
  },
  {
    id: "notes",
    title: "Le journal de chantier",
    purpose:
      "De courtes fiches datées qui consignent ce qui s'est passé sur le chantier : décisions, appels, livraisons, inspections et paiements.",
    steps: [
      "Écrivez dans le champ d'ajout rapide “Prendre une note…” en haut de la page ; dès que vous cliquez dedans, le champ du corps apparaît.",
      "Donnez éventuellement une catégorie à la note : “Inspection”, “Livraison”, “Paiement”, “Décision”, “Appel” ou “Général”.",
      "Enregistrez la note. Les fiches se regroupent d'elles-mêmes sous “Aujourd'hui”, “Hier”, “Plus tôt cette semaine” et “Antérieur”.",
      "Cliquez sur une fiche pour la modifier sur place, ou cochez-la pour la marquer comme terminée et décochez-la pour la rouvrir.",
      "Cherchez dans le journal, ou restreignez-le avec le filtre de catégorie.",
    ],
    whoCanDoIt:
      "Toute personne sur le projet peut lire le journal. Écrire, modifier, marquer comme terminé et supprimer demandent tous le droit “Modifier le projet”.",
    gotchas: [
      "Supprimer une note ne demande aucune confirmation : elle disparaît aussitôt, avec un bref message “Annuler”. Une fois ce message passé, la note est perdue.",
    ],
  },
  {
    id: "documents",
    title: "Les documents du projet",
    purpose:
      "La bibliothèque de fichiers du chantier — plans, contrats, permis — avec les étiquettes, l'aperçu, le renommage et la suppression.",
    steps: [
      "Glissez des fichiers sur la zone de dépôt ou cliquez pour les choisir. PDF, PNG, JPG, WebP, DOCX, XLSX, DWG et TXT sont acceptés, jusqu'à 150 Mo chacun.",
      "Les envois se déroulent tout seuls ; chaque ligne passe de “En attente” à “Envoi en cours”, puis “Envoyé”.",
      "Restreignez la bibliothèque avec les pastilles de type, le menu du déposant et les pastilles d'étiquettes, puis remettez tout à zéro d'un clic avec “Réinitialiser”.",
      "Par fichier : afficher l'aperçu d'un PDF ou d'une image, le télécharger, le renommer — l'extension ne peut pas changer — ou le supprimer.",
      "Ajoutez des étiquettes libres directement depuis la colonne “Étiquettes”.",
    ],
    whoCanDoIt:
      "Réservé aux administrateurs et aux managers du projet. C'est la seule partie d'un projet qu'un simple membre ne peut même pas lire, et le menu latéral la lui masque entièrement.",
    gotchas: [
      "Renommer ou supprimer peut être refusé même à un manager : seule la personne qui a déposé le fichier, ou un administrateur du projet, peut y toucher.",
    ],
  },
  {
    id: "photos",
    title: "Photos et vidéos du chantier",
    purpose:
      "La mémoire visuelle du chantier — photos et vidéos d'avancement, chacune avec une légende et sa date de prise de vue.",
    steps: [
      "Ouvrez “Médias” depuis la carte d'un projet.",
      "Cliquez sur “Ajouter des médias” pour téléverser. Les images acceptent JPEG, PNG ou WebP jusqu'à 25 Mo ; les vidéos acceptent MP4, WebM ou MOV jusqu'à 50 Mo.",
      "Ouvrez un élément pour écrire une légende décrivant ce qui est visible, et pour renseigner la date de prise de vue.",
      "Supprimez un élément au même endroit ; une confirmation est demandée, et la suppression est définitive.",
    ],
    whoCanDoIt:
      "Toute personne sur le projet peut regarder. Téléverser, légender et supprimer demandent le droit “Modifier le projet”.",
  },
  {
    id: "analyses",
    title: "Les rapports d'analyse",
    purpose:
      "Une étagère de rapports et de guides HTML enregistrés pour le chantier, chacun s'ouvrant dans un lecteur sans distraction.",
    steps: [
      "Cliquez sur “Téléverser une analyse” et choisissez le rapport HTML — il doit être autonome, sans fichier externe, et peser 2 Mo au maximum.",
      "Donnez-lui un titre et, si vous le souhaitez, un résumé, une URL source et des étiquettes.",
      "Restreignez l'étagère avec le champ de recherche et les pastilles d'étiquettes.",
      "Cliquez sur une fiche pour ouvrir le lecteur ; le panneau à côté indique qui l'a déposé, quand, et sa source.",
      "Utilisez “Modifier” ou “Supprimer” sur la page du rapport lui-même.",
    ],
    whoCanDoIt:
      "Toute personne sur le projet peut lire. Téléverser, modifier et supprimer demandent le droit “Modifier le projet”.",
    gotchas: [
      "Il n'y a ni modification ni suppression sur une fiche de la grille — ouvrez d'abord le rapport.",
    ],
  },
  {
    id: "bibliotheque",
    title: "La bibliothèque de produits",
    purpose:
      "Le catalogue, commun à toute l'entreprise, des produits que vous achetez chez vos fournisseurs, avec leur historique d'achats et une comparaison des prix côte à côte.",
    steps: [
      "Cherchez par nom de produit, ou filtrez par fournisseur et par catégorie.",
      "Cliquez sur “Ajouter un produit”, choisissez un fournisseur existant ou créez-en un, puis renseignez le nom — obligatoire — et, si vous le souhaitez, une référence, une catégorie, une taille, une description, un lien et une image.",
      "Cliquez sur la fiche d'un produit pour son détail et son historique d'achats : date, référence, ticket, commande, quantité et prix unitaire.",
      "Depuis cette fenêtre, modifiez le produit ou supprimez-le. La suppression vous demande de taper le nom du produit.",
      "Cliquez sur “Comparer”, cochez jusqu'à quatre produits, puis comparez-les côte à côte.",
    ],
    whoCanDoIt:
      "Toute personne rattachée à une entreprise peut la consulter. Les boutons d'ajout, de modification et de suppression sont toujours affichés, mais le serveur refuse les changements si vous n'avez pas la permission “Gérer la bibliothèque”, et il vous le dit.",
    gotchas: [
      "La bibliothèque appartient à une seule entreprise — votre entreprise principale — et il n'y a pas de sélecteur d'entreprise.",
    ],
  },
  {
    id: "billing-devis",
    title: "Les devis",
    purpose:
      "Les devis que votre entreprise émet pour ses propres clients : les rédiger, les envoyer, les suivre, et transformer un devis accepté en facture.",
    steps: [
      "Ouvrez “Facturation” → “Devis” et cliquez sur “Nouveau devis”.",
      "Partez d'un document “Vierge”, “Depuis un existant” ou “Depuis un modèle”.",
      "Si vous administrez plusieurs entreprises, choisissez celle qui émet le devis.",
      "Renseignez le destinataire — le nom est obligatoire — et les détails : date d'émission, date de validité, et éventuellement le chantier concerné.",
      "Ajoutez les lignes, vérifiez les totaux, et créez le devis.",
      "Faites avancer son statut de “Brouillon” à “Envoyé” puis “Accepté”, et utilisez ensuite “Convertir en facture”.",
    ],
    whoCanDoIt:
      "Réservé aux administrateurs d'entreprise. Les autres ne voient pas du tout le groupe “Facturation”.",
  },
  {
    id: "billing-factures",
    title: "Les factures clients",
    purpose:
      "Les factures que votre entreprise émet pour ses clients, suivies jusqu'au paiement, avec export PDF et tableur.",
    steps: [
      "Ouvrez “Facturation” → “Factures” et cliquez sur “Nouvelle facture”.",
      "Partez d'un document “Vierge”, “Depuis un existant” ou “Depuis un modèle”, et choisissez l'entreprise émettrice si vous en administrez plusieurs.",
      "Renseignez le destinataire, puis la date d'émission, l'échéance de paiement, les conditions de paiement, et éventuellement un chantier.",
      "Ajoutez les lignes, vérifiez les totaux calculés en direct, et créez la facture.",
      "Faites avancer le statut : “Brouillon”, “Envoyée”, puis “Payée”, “En retard” ou “Annulée”. Une facture en retard peut encore être marquée payée.",
      "Téléchargez la facture en PDF ou en XLSX, ou supprimez-la — la suppression demande confirmation.",
    ],
    whoCanDoIt: "Réservé aux administrateurs d'entreprise.",
    gotchas: [
      "Une fois une facture marquée payée, le seul statut restant est “Marquer comme annulée (remboursement)”.",
    ],
  },
  {
    id: "billing-templates",
    title: "Les modèles de devis et de facture",
    purpose:
      "Des squelettes réutilisables pour les documents que vous émettez souvent : les lignes, le taux de TVA par défaut, les notes et vos conditions générales.",
    steps: [
      "Ouvrez “Facturation” → “Modèles”. Si vous administrez plusieurs entreprises, choisissez de laquelle afficher les modèles — un modèle appartient à une seule entreprise.",
      "Cliquez sur “Nouveau modèle” et choisissez son type, “Devis” ou “Facture”. Le type ne peut plus être changé ensuite.",
      "Nommez le modèle et fixez un taux de TVA par défaut, en prenant un des taux courants ou un taux personnalisé.",
      "Ajoutez les lignes et, si vous le souhaitez, des notes et vos conditions générales (CGV), puis enregistrez.",
      "Depuis la liste, “Utiliser” un modèle ouvre un nouveau document déjà rempli.",
    ],
    whoCanDoIt: "Réservé aux administrateurs d'entreprise.",
    gotchas: ["Deux modèles du même type ne peuvent pas porter le même nom."],
  },
  {
    id: "billing-refundable",
    title: "Les dépenses à rembourser",
    purpose:
      "Une vue, pour toute l'entreprise, des dépenses “Achats & prestations” marquées à rembourser sur l'ensemble des chantiers, et de l'avancement de chaque remboursement.",
    steps: [
      "Ouvrez “Facturation” → “Remboursables”.",
      "Cliquez sur “Ajouter une dépense remboursable” et cherchez parmi les dépenses pas encore marquées, par chantier, par numéro ou par destinataire.",
      "Cochez celles à suivre et ajoutez-les.",
      "Réglez le statut de chaque ligne : “Remboursable”, “Remboursement en cours”, remboursé par la société, par la banque ou par les deux — ou retirez complètement la marque.",
      "Ouvrez les pièces jointes d'une dépense depuis la colonne “Facture” pour vérifier les justificatifs.",
      "Lisez les totaux : total remboursé, remboursé par la société, remboursé par la banque, et encore à rembourser.",
    ],
    whoCanDoIt: "Réservé aux administrateurs d'entreprise.",
    gotchas: [
      "Le tableau affiche 200 lignes au maximum ; au-delà, il vous indique combien il en montre.",
    ],
  },
  {
    id: "company",
    title: "Votre entreprise, ses membres et les permissions",
    purpose:
      "Les sociétés auxquelles vous êtes rattaché et, pour celles que vous administrez, le code société, les rôles des membres, les permissions accordées et l'annuaire des personnes.",
    steps: [
      "Ouvrez “Paramètres” → “Entreprise”.",
      "Cliquez sur “Ajouter une société” et collez un jeton d'invitation ou saisissez un code société pour vous rattacher à une autre.",
      "Si vous appartenez à plusieurs sociétés, passez de l'une à l'autre avec le sélecteur d'entreprise ; une pastille indique votre rôle dans chacune.",
      "Utilisez “Définir comme principale” pour choisir votre société par défaut, ou “Détacher” pour en sortir.",
      "En tant qu'administrateur, gérez le code société : créez-le, renouvelez-le, révoquez-le, ou copiez-le pour le partager. C'est ce code que l'on saisit dans l'application mobile pour rejoindre l'entreprise comme membre.",
      "Dans le tableau des membres, changez le rôle de quelqu'un, ou ouvrez “Permissions personnalisées” pour accorder ou refuser une permission précise, sur toute l'entreprise ou sur un seul projet.",
      "Utilisez “Ajouter par téléphone” pour ajouter quelqu'un par son numéro, ou “Importer depuis une entreprise” pour reprendre des personnes d'une autre société que vous administrez.",
      "L'annuaire liste toutes les personnes liées à l'entreprise, avec leur téléphone, le fait qu'elles se soient déjà connectées ou non, et les projets qui leur sont assignés.",
      "Sous “Moyens de paiement”, ajoutez, renommez ou supprimez les façons dont les factures de cette société peuvent être payées. Les moyens intégrés se renomment mais ne se suppriment pas.",
    ],
    whoCanDoIt:
      "Chacun voit les sociétés auxquelles il est rattaché et peut en rattacher une autre. Le code société, le tableau des membres, l'annuaire et les moyens de paiement sont réservés aux administrateurs de la société sélectionnée.",
    gotchas: [
      "Il y a deux façons différentes d'ajouter une personne, et elles ne sont pas interchangeables : un jeton d'invitation à usage unique valable sept jours, et le code société réutilisable que l'on saisit dans l'application mobile.",
    ],
  },
  {
    id: "settings",
    title: "Votre profil et vos préférences",
    purpose:
      "Vos informations personnelles, la numérotation des factures du projet en cours, et les notifications qui arrivent sur votre téléphone.",
    steps: [
      "Ouvrez “Paramètres” ; la liste à gauche sélectionne la section.",
      "Dans “Profil”, modifiez votre nom affiché et votre téléphone, puis enregistrez. Votre e-mail est en lecture seule — seul un administrateur peut le changer.",
      "Dans “Projet”, fixez le préfixe de numéro de facture du projet sélectionné, jusqu'à huit lettres ou chiffres, et regardez la ligne d'aperçu avant d'enregistrer.",
      "Dans “Notifications”, utilisez l'interrupteur général et les interrupteurs par catégorie : “Discussion d'équipe”, “Présences”, “Tâches”, “Équipe et accès” et “Argent”.",
      "“À propos” indique la version de Folio que vous utilisez.",
    ],
    whoCanDoIt:
      "Chacun accède à son profil, au préfixe du projet et à ses choix de notification. Les moyens de paiement ont rejoint “Entreprise”, où ils sont proposés aux administrateurs de la société sélectionnée.",
    gotchas: [
      "Les entrées “Équipe” et “Facturation” des paramètres sont des emplacements réservés. La vraie facturation est le groupe “Facturation” du menu latéral.",
      "Les interrupteurs de notification commandent les notifications push qui arrivent dans l'application mobile Folio, pas la cloche de cette fenêtre.",
    ],
  },
  {
    id: "notifications",
    title: "La cloche",
    purpose:
      "Un court fil en direct de ce qui demande votre attention : les rappels de notes arrivés à échéance, les journées pointées par un ouvrier qui attendent une validation, et les personnes qui viennent de rejoindre votre entreprise.",
    steps: [
      "Cliquez sur la cloche dans la barre du haut. Sa pastille compte les rappels et les pointages, et affiche “9+” au-delà de neuf.",
      "Sous “Pointages à valider”, utilisez “Valider” ou “Refuser” sur chaque journée déclarée par un ouvrier.",
      "Cliquez sur un rappel pour aller aux notes du projet concerné, ou écartez-le avec la croix ✕.",
      "“Nouveaux membres” liste les personnes qui viennent de rejoindre votre entreprise, avec un lien vers la page de paramètres où les placer.",
    ],
    whoCanDoIt:
      "Tout le monde voit la cloche. Son contenu se décide personne par personne : les lignes de pointage ne parviennent qu'à ceux qui les valident.",
    gotchas: [
      "Les arrivées de nouveaux membres ne sont pas comptées dans la pastille : le panneau peut donc contenir quelque chose alors que la cloche paraît muette.",
      "Le fil se rafraîchit environ une fois par minute, et non instantanément.",
    ],
  },
  {
    id: "chat",
    title: "La discussion d'équipe",
    purpose:
      "Une conversation avec votre société et vos équipes de chantier, un canal par société et par chantier.",
    steps: [
      "Ouvrez la discussion depuis son bouton, dans le coin de la fenêtre.",
      "Choisissez un canal dans la liste ; les canaux non lus sont signalés.",
      "Écrivez votre message et envoyez-le.",
      "Joignez une photo à un message quand une image va plus vite.",
      "Les avatars sous le dernier message montrent qui a lu jusque-là.",
    ],
    whoCanDoIt:
      "Tout le monde. Les canaux que vous voyez suivent votre accès à l'entreprise et les projets sur lesquels vous êtes. La discussion peut être désactivée sur un serveur, auquel cas elle vous le dit.",
  },
];

/** The panel's own labels in this language. */
export const helpChromeFr: HelpChrome = {
  title: "Comment fonctionne Folio",
  subtitle: "Tous les processus, étape par étape.",
  back: "Tous les sujets",
  steps: "Étapes",
  whoCanDoIt: "Qui peut le faire",
  gotchas: "Bon à savoir",
  close: "Fermer le guide",
};
