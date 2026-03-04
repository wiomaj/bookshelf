export type Locale = 'en' | 'de' | 'fr' | 'es' | 'pl'

export const LANGUAGES: { code: Locale; label: string; flag: string }[] = [
  { code: 'en', label: 'English',  flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch',  flag: '🇩🇪' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'es', label: 'Español',  flag: '🇪🇸' },
  { code: 'pl', label: 'Polski',   flag: '🇵🇱' },
]

export type Translations = {
  // App / home
  myBookshelf: string
  loadingBookshelf: string
  noBooks: string
  addFirstBook: string
  addFirstBookBullet1: string
  addFirstBookBullet2: string
  addFirstBookCta: string
  settings: string
  // Add / edit pages
  addABook: string
  addBook: string
  saveChanges: string
  editBook: string
  changesSaved: string
  // Book form
  titleLabel: string
  titlePlaceholder: string
  authorLabel: string
  authorPlaceholder: string
  whenDidYouRead: string
  unknownMonth: string
  ratingLabel: string
  ratingLabels: [string, string, string, string, string]
  myNotesLabel: string
  notesPlaceholder: string
  coverPreview: string
  removeCover: string
  // View page
  noNotesAdded: string
  released: string
  genre: string
  aboutTheBook: string
  noDescriptionAvailable: string
  loading: string
  deleteBook: string
  bookNotFound: string
  backToBookshelf: string
  // Confirm dialog
  deleteDialogTitle: string
  deleteDialogSuffix: string
  deleting: string
  cancel: string
  // Settings
  cozyMode: string
  cozyModeDescription: string
  language: string
  signOut: string
  // Auth
  email: string
  password: string
  confirmPassword: string
  signIn: string
  signUp: string
  signingIn: string
  signingUp: string
  noAccount: string
  haveAccount: string
  passwordMismatch: string
  checkYourEmail: string
  checkYourEmailDesc: string
  backToSignIn: string
  // Login page
  loginTitle: string
  loginSubtitle: string
  signUpPageTitle: string
  signUpPageSubtitle: string
  logIn: string
  // My Account
  myAccount: string
  changePassword: string
  newPassword: string
  confirmNewPassword: string
  savePassword: string
  savingPassword: string
  passwordChangedSuccess: string
  deleteAccount: string
  deleteAccountDesc: string
  // Forgot / reset password
  forgotPassword: string
  resetYourPassword: string
  resetPasswordDesc: string
  sendResetLink: string
  sendingResetLink: string
  resetLinkSent: string
  resetLinkSentDesc: string
  setNewPassword: string
  setNewPasswordDesc: string
  passwordResetSuccess: string
  // To Read tab
  readBooksTitle: string
  toReadBooksTitle: string
  tabRead: string
  tabToRead: string
  toReadEmptyTitle: string
  toReadEmptyCopy: string
  addToReadingList: string
  markAsRead: string
  toReadNotesPlaceholder: string
  whenDidYouGetIt: string
  // Add to Home Screen
  athsTitle: string
  athsAndroid: string
  athsIosTap: string
  athsIosThen: string
  athsInstall: string
}

const en: Translations = {
  myBookshelf: 'My bookshelf',
  loadingBookshelf: 'Loading your bookshelf…',
  noBooks: 'Welcome to your bookshelf!',
  addFirstBook: 'Track the books you\'ve read:',
  addFirstBookBullet1: '📘 Remember over time what you read',
  addFirstBookBullet2: '📘 Add personal ratings',
  addFirstBookCta: 'Add my first book',
  settings: 'Settings',
  addABook: 'Add a book you read',
  addBook: 'Add Book',
  saveChanges: 'Save Changes',
  editBook: 'Edit book',
  changesSaved: 'Changes saved!',
  titleLabel: 'Title',
  titlePlaceholder: 'Start typing to search…',
  authorLabel: 'Author',
  authorPlaceholder: 'Enter author name...',
  whenDidYouRead: 'When did you read it?',
  unknownMonth: '— Unknown month —',
  ratingLabel: 'Rating',
  ratingLabels: ["Didn't like it", "It was okay", "Liked it", "Really liked it", "Loved it"],
  myNotesLabel: 'My Notes',
  notesPlaceholder: 'What did you think about this book?',
  coverPreview: 'Cover preview',
  removeCover: 'Remove cover',
  noNotesAdded: 'No notes added.',
  released: 'Released',
  genre: 'Genre',
  aboutTheBook: 'About the book',
  noDescriptionAvailable: 'No description available.',
  loading: 'Loading…',
  deleteBook: 'Delete book',
  bookNotFound: 'Book not found',
  backToBookshelf: 'Back to bookshelf',
  deleteDialogTitle: 'Delete this book?',
  deleteDialogSuffix: 'will be permanently removed from your bookshelf.',
  deleting: 'Deleting…',
  cancel: 'Cancel',
  cozyMode: 'Cozy mode',
  cozyModeDescription: 'Cozy mode makes your app feel like a warm living room!',
  language: 'Language',
  signOut: 'Sign out',
  email: 'Email',
  password: 'Password',
  confirmPassword: 'Confirm password',
  signIn: 'Sign in',
  signUp: 'Create account',
  signingIn: 'Signing in…',
  signingUp: 'Creating account…',
  noAccount: "Don't have an account?",
  haveAccount: 'Already have an account?',
  passwordMismatch: 'Passwords do not match.',
  checkYourEmail: 'Check your email',
  checkYourEmailDesc: 'We sent you a confirmation link. Click it to activate your account, then come back to sign in.',
  backToSignIn: 'Back to sign in',
  loginTitle: 'Login to your bookshelf!',
  loginSubtitle: "Track the books you've read!",
  signUpPageTitle: 'Create your account!',
  signUpPageSubtitle: 'Start tracking your books today!',
  logIn: 'Log In',
  myAccount: 'My Account',
  changePassword: 'Change password',
  newPassword: 'New password',
  confirmNewPassword: 'Confirm new password',
  savePassword: 'Save password',
  savingPassword: 'Saving…',
  passwordChangedSuccess: 'Password changed successfully.',
  deleteAccount: 'Delete account',
  deleteAccountDesc: 'This will permanently delete your account and all your books. This cannot be undone.',
  forgotPassword: 'Forgot password?',
  resetYourPassword: 'Reset your password',
  resetPasswordDesc: 'Enter your email and we\'ll send you a reset link.',
  sendResetLink: 'Send reset link',
  sendingResetLink: 'Sending…',
  resetLinkSent: 'Check your email',
  resetLinkSentDesc: 'We sent you a password reset link. Click it to set a new password.',
  setNewPassword: 'Set new password',
  setNewPasswordDesc: 'Enter a new password for your account.',
  passwordResetSuccess: 'Password updated! You can now sign in.',
  readBooksTitle: 'Read books',
  toReadBooksTitle: 'Books to read',
  tabRead: 'Read',
  tabToRead: 'To Read',
  toReadEmptyTitle: 'Unread books',
  toReadEmptyCopy: 'Add the books you already own, but haven\'t read so far... So many books, so little time.',
  addToReadingList: 'Add a book to be read',
  markAsRead: 'Mark as Read',
  toReadNotesPlaceholder: 'Why do you want to read this?',
  whenDidYouGetIt: 'When did you get it?',
  athsTitle: 'Add to Home Screen',
  athsAndroid: 'Install for the full app experience',
  athsIosTap: 'Tap',
  athsIosThen: 'then',
  athsInstall: 'Install',
}

const de: Translations = {
  myBookshelf: 'Mein Bücherregal',
  loadingBookshelf: 'Bücherregal wird geladen…',
  noBooks: 'Willkommen in deinem Bücherregal!',
  addFirstBook: 'Verfolge deine gelesenen Bücher:',
  addFirstBookBullet1: '📘 Erinnere dich, was du gelesen hast',
  addFirstBookBullet2: '📘 Persönliche Bewertungen hinzufügen',
  addFirstBookCta: 'Erstes Buch hinzufügen',
  settings: 'Einstellungen',
  addABook: 'Buch hinzufügen',
  addBook: 'Hinzufügen',
  saveChanges: 'Änderungen speichern',
  editBook: 'Buch bearbeiten',
  changesSaved: 'Änderungen gespeichert!',
  titleLabel: 'Titel',
  titlePlaceholder: 'Tippe, um zu suchen…',
  authorLabel: 'Autor',
  authorPlaceholder: 'Autorenname eingeben...',
  whenDidYouRead: 'Wann hast du es gelesen?',
  unknownMonth: '— Unbekannter Monat —',
  ratingLabel: 'Bewertung',
  ratingLabels: ['Hat mir nicht gefallen', 'War okay', 'Hat mir gefallen', 'Hat mir sehr gefallen', 'Geliebt'],
  myNotesLabel: 'Meine Notizen',
  notesPlaceholder: 'Was hast du über dieses Buch gedacht?',
  coverPreview: 'Cover-Vorschau',
  removeCover: 'Cover entfernen',
  noNotesAdded: 'Keine Notizen hinzugefügt.',
  released: 'Erschienen',
  genre: 'Genre',
  aboutTheBook: 'Über das Buch',
  noDescriptionAvailable: 'Keine Beschreibung verfügbar.',
  loading: 'Wird geladen…',
  deleteBook: 'Buch löschen',
  bookNotFound: 'Buch nicht gefunden',
  backToBookshelf: 'Zurück zum Regal',
  deleteDialogTitle: 'Dieses Buch löschen?',
  deleteDialogSuffix: 'wird dauerhaft aus deinem Regal entfernt.',
  deleting: 'Wird gelöscht…',
  cancel: 'Abbrechen',
  cozyMode: 'Gemütlichkeitsmodus',
  cozyModeDescription: 'Der Gemütlichkeitsmodus lässt die App wie ein warmes Wohnzimmer wirken!',
  language: 'Sprache',
  signOut: 'Abmelden',
  email: 'E-Mail',
  password: 'Passwort',
  confirmPassword: 'Passwort bestätigen',
  signIn: 'Anmelden',
  signUp: 'Konto erstellen',
  signingIn: 'Anmelden…',
  signingUp: 'Konto erstellen…',
  noAccount: 'Noch kein Konto?',
  haveAccount: 'Bereits ein Konto?',
  passwordMismatch: 'Passwörter stimmen nicht überein.',
  checkYourEmail: 'Prüfe deine E-Mail',
  checkYourEmailDesc: 'Wir haben dir einen Bestätigungslink geschickt. Klick ihn an, um dein Konto zu aktivieren, und melde dich dann an.',
  backToSignIn: 'Zurück zur Anmeldung',
  loginTitle: 'Melde dich an!',
  loginSubtitle: 'Verfolge die Bücher, die du gelesen hast!',
  signUpPageTitle: 'Erstelle dein Konto!',
  signUpPageSubtitle: 'Fang noch heute an, deine Bücher zu verfolgen!',
  logIn: 'Anmelden',
  myAccount: 'Mein Konto',
  changePassword: 'Passwort ändern',
  newPassword: 'Neues Passwort',
  confirmNewPassword: 'Neues Passwort bestätigen',
  savePassword: 'Passwort speichern',
  savingPassword: 'Speichern…',
  passwordChangedSuccess: 'Passwort erfolgreich geändert.',
  deleteAccount: 'Konto löschen',
  deleteAccountDesc: 'Dein Konto und alle deine Bücher werden dauerhaft gelöscht. Dies kann nicht rückgängig gemacht werden.',
  forgotPassword: 'Passwort vergessen?',
  resetYourPassword: 'Passwort zurücksetzen',
  resetPasswordDesc: 'Gib deine E-Mail ein und wir senden dir einen Reset-Link.',
  sendResetLink: 'Reset-Link senden',
  sendingResetLink: 'Senden…',
  resetLinkSent: 'Prüfe deine E-Mail',
  resetLinkSentDesc: 'Wir haben dir einen Passwort-Reset-Link geschickt. Klick ihn an, um ein neues Passwort zu setzen.',
  setNewPassword: 'Neues Passwort setzen',
  setNewPasswordDesc: 'Gib ein neues Passwort für dein Konto ein.',
  passwordResetSuccess: 'Passwort aktualisiert! Du kannst dich jetzt anmelden.',
  readBooksTitle: 'Gelesene Bücher',
  toReadBooksTitle: 'Bücher zum Lesen',
  tabRead: 'Gelesen',
  tabToRead: 'Leseliste',
  toReadEmptyTitle: 'Ungelesene Bücher',
  toReadEmptyCopy: 'Füge Bücher hinzu, die du schon besitzt, aber noch nicht gelesen hast… So viele Bücher, so wenig Zeit.',
  addToReadingList: 'Buch hinzufügen',
  markAsRead: 'Als gelesen markieren',
  whenDidYouGetIt: 'Wann hast du es bekommen?',
  toReadNotesPlaceholder: 'Warum möchtest du das lesen?',
  athsTitle: 'Zum Startbildschirm',
  athsAndroid: 'Installieren für das volle App-Erlebnis',
  athsIosTap: 'Tippe auf',
  athsIosThen: 'dann auf',
  athsInstall: 'Installieren',
}

const fr: Translations = {
  myBookshelf: 'Ma bibliothèque',
  loadingBookshelf: 'Chargement…',
  noBooks: 'Bienvenue dans ta bibliothèque !',
  addFirstBook: 'Suis les livres que tu as lus :',
  addFirstBookBullet1: '📘 Souviens-toi de tes lectures',
  addFirstBookBullet2: '📘 Ajoute des évaluations personnelles',
  addFirstBookCta: 'Ajouter votre premier livre',
  settings: 'Paramètres',
  addABook: 'Ajouter un livre lu',
  addBook: 'Ajouter',
  saveChanges: 'Enregistrer',
  editBook: 'Modifier le livre',
  changesSaved: 'Modifications enregistrées !',
  titleLabel: 'Titre',
  titlePlaceholder: 'Commencez à taper pour rechercher…',
  authorLabel: 'Auteur',
  authorPlaceholder: "Entrez le nom de l'auteur...",
  whenDidYouRead: "Quand l'avez-vous lu ?",
  unknownMonth: '— Mois inconnu —',
  ratingLabel: 'Note',
  ratingLabels: ['Pas aimé', 'Passable', 'Aimé', 'Vraiment aimé', 'Adoré'],
  myNotesLabel: 'Mes notes',
  notesPlaceholder: "Qu'avez-vous pensé de ce livre ?",
  coverPreview: 'Aperçu de la couverture',
  removeCover: 'Supprimer la couverture',
  noNotesAdded: 'Aucune note ajoutée.',
  released: 'Parution',
  genre: 'Genre',
  aboutTheBook: 'À propos du livre',
  noDescriptionAvailable: 'Aucune description disponible.',
  loading: 'Chargement…',
  deleteBook: 'Supprimer le livre',
  bookNotFound: 'Livre introuvable',
  backToBookshelf: 'Retour à la bibliothèque',
  deleteDialogTitle: 'Supprimer ce livre ?',
  deleteDialogSuffix: 'sera définitivement supprimé de votre bibliothèque.',
  deleting: 'Suppression…',
  cancel: 'Annuler',
  cozyMode: 'Mode cosy',
  cozyModeDescription: "Le mode cosy donne à l'application l'ambiance d'un salon chaleureux !",
  language: 'Langue',
  signOut: 'Se déconnecter',
  email: 'E-mail',
  password: 'Mot de passe',
  confirmPassword: 'Confirmer le mot de passe',
  signIn: 'Se connecter',
  signUp: 'Créer un compte',
  signingIn: 'Connexion…',
  signingUp: 'Création du compte…',
  noAccount: 'Pas encore de compte ?',
  haveAccount: 'Déjà un compte ?',
  passwordMismatch: 'Les mots de passe ne correspondent pas.',
  checkYourEmail: 'Vérifiez vos e-mails',
  checkYourEmailDesc: 'Nous vous avons envoyé un lien de confirmation. Cliquez dessus pour activer votre compte, puis revenez vous connecter.',
  backToSignIn: 'Retour à la connexion',
  loginTitle: 'Connectez-vous à votre bibliothèque !',
  loginSubtitle: 'Suivez les livres que vous avez lus !',
  signUpPageTitle: 'Créez votre compte !',
  signUpPageSubtitle: 'Commencez à suivre vos lectures dès aujourd\'hui !',
  logIn: 'Se connecter',
  myAccount: 'Mon compte',
  changePassword: 'Changer le mot de passe',
  newPassword: 'Nouveau mot de passe',
  confirmNewPassword: 'Confirmer le nouveau mot de passe',
  savePassword: 'Enregistrer le mot de passe',
  savingPassword: 'Enregistrement…',
  passwordChangedSuccess: 'Mot de passe modifié avec succès.',
  deleteAccount: 'Supprimer le compte',
  deleteAccountDesc: 'Votre compte et tous vos livres seront supprimés définitivement. Cette action est irréversible.',
  forgotPassword: 'Mot de passe oublié ?',
  resetYourPassword: 'Réinitialiser votre mot de passe',
  resetPasswordDesc: 'Entrez votre e-mail et nous vous enverrons un lien de réinitialisation.',
  sendResetLink: 'Envoyer le lien',
  sendingResetLink: 'Envoi…',
  resetLinkSent: 'Vérifiez vos e-mails',
  resetLinkSentDesc: 'Nous vous avons envoyé un lien de réinitialisation. Cliquez dessus pour définir un nouveau mot de passe.',
  setNewPassword: 'Définir un nouveau mot de passe',
  setNewPasswordDesc: 'Entrez un nouveau mot de passe pour votre compte.',
  passwordResetSuccess: 'Mot de passe mis à jour ! Vous pouvez maintenant vous connecter.',
  readBooksTitle: 'Livres lus',
  toReadBooksTitle: 'Livres à lire',
  tabRead: 'Lus',
  tabToRead: 'À lire',
  toReadEmptyTitle: 'Livres non lus',
  toReadEmptyCopy: 'Ajoute les livres que tu possèdes déjà mais que tu n\'as pas encore lus… Tant de livres, si peu de temps.',
  addToReadingList: 'Ajouter un livre à lire',
  markAsRead: 'Marquer comme lu',
  whenDidYouGetIt: 'Quand l\'avez-vous reçu ?',
  toReadNotesPlaceholder: 'Pourquoi voulez-vous le lire ?',
  athsTitle: 'Ajouter à l\'écran d\'accueil',
  athsAndroid: 'Installez pour une expérience complète',
  athsIosTap: 'Appuyez sur',
  athsIosThen: 'puis sur',
  athsInstall: 'Installer',
}

const es: Translations = {
  myBookshelf: 'Mi estantería',
  loadingBookshelf: 'Cargando tu estantería…',
  noBooks: '¡Bienvenido a tu estantería!',
  addFirstBook: 'Lleva el registro de tus lecturas:',
  addFirstBookBullet1: '📘 Recuerda lo que leíste con el tiempo',
  addFirstBookBullet2: '📘 Añade valoraciones personales',
  addFirstBookCta: 'Añadir tu primer libro',
  settings: 'Ajustes',
  addABook: 'Añadir un libro leído',
  addBook: 'Añadir',
  saveChanges: 'Guardar cambios',
  editBook: 'Editar libro',
  changesSaved: '¡Cambios guardados!',
  titleLabel: 'Título',
  titlePlaceholder: 'Empieza a escribir para buscar…',
  authorLabel: 'Autor',
  authorPlaceholder: 'Introduce el nombre del autor...',
  whenDidYouRead: '¿Cuándo lo leíste?',
  unknownMonth: '— Mes desconocido —',
  ratingLabel: 'Valoración',
  ratingLabels: ['No me gustó', 'Estuvo bien', 'Me gustó', 'Me gustó mucho', 'Lo amé'],
  myNotesLabel: 'Mis notas',
  notesPlaceholder: '¿Qué te pareció este libro?',
  coverPreview: 'Vista previa de portada',
  removeCover: 'Eliminar portada',
  noNotesAdded: 'No hay notas añadidas.',
  released: 'Publicado',
  genre: 'Género',
  aboutTheBook: 'Sobre el libro',
  noDescriptionAvailable: 'No hay descripción disponible.',
  loading: 'Cargando…',
  deleteBook: 'Eliminar libro',
  bookNotFound: 'Libro no encontrado',
  backToBookshelf: 'Volver a la estantería',
  deleteDialogTitle: '¿Eliminar este libro?',
  deleteDialogSuffix: 'se eliminará permanentemente de tu estantería.',
  deleting: 'Eliminando…',
  cancel: 'Cancelar',
  cozyMode: 'Modo acogedor',
  cozyModeDescription: '¡El modo acogedor hace que la app parezca una sala de estar cálida!',
  language: 'Idioma',
  signOut: 'Cerrar sesión',
  email: 'Correo electrónico',
  password: 'Contraseña',
  confirmPassword: 'Confirmar contraseña',
  signIn: 'Iniciar sesión',
  signUp: 'Crear cuenta',
  signingIn: 'Iniciando sesión…',
  signingUp: 'Creando cuenta…',
  noAccount: '¿No tienes cuenta?',
  haveAccount: '¿Ya tienes cuenta?',
  passwordMismatch: 'Las contraseñas no coinciden.',
  checkYourEmail: 'Revisa tu correo',
  checkYourEmailDesc: 'Te enviamos un enlace de confirmación. Haz clic en él para activar tu cuenta y vuelve a iniciar sesión.',
  backToSignIn: 'Volver a iniciar sesión',
  loginTitle: '¡Inicia sesión en tu estantería!',
  loginSubtitle: '¡Lleva un seguimiento de los libros que has leído!',
  signUpPageTitle: '¡Crea tu cuenta!',
  signUpPageSubtitle: '¡Empieza a registrar tus lecturas hoy!',
  logIn: 'Iniciar sesión',
  myAccount: 'Mi cuenta',
  changePassword: 'Cambiar contraseña',
  newPassword: 'Nueva contraseña',
  confirmNewPassword: 'Confirmar nueva contraseña',
  savePassword: 'Guardar contraseña',
  savingPassword: 'Guardando…',
  passwordChangedSuccess: 'Contraseña cambiada correctamente.',
  deleteAccount: 'Eliminar cuenta',
  deleteAccountDesc: 'Tu cuenta y todos tus libros se eliminarán permanentemente. Esta acción no se puede deshacer.',
  forgotPassword: '¿Olvidaste tu contraseña?',
  resetYourPassword: 'Restablecer contraseña',
  resetPasswordDesc: 'Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.',
  sendResetLink: 'Enviar enlace',
  sendingResetLink: 'Enviando…',
  resetLinkSent: 'Revisa tu correo',
  resetLinkSentDesc: 'Te enviamos un enlace para restablecer tu contraseña. Haz clic en él para establecer una nueva.',
  setNewPassword: 'Establecer nueva contraseña',
  setNewPasswordDesc: 'Ingresa una nueva contraseña para tu cuenta.',
  passwordResetSuccess: '¡Contraseña actualizada! Ya puedes iniciar sesión.',
  readBooksTitle: 'Libros leídos',
  toReadBooksTitle: 'Libros por leer',
  tabRead: 'Leídos',
  tabToRead: 'Por leer',
  toReadEmptyTitle: 'Libros sin leer',
  toReadEmptyCopy: 'Añade los libros que ya tienes pero aún no has leído… Tantos libros, tan poco tiempo.',
  addToReadingList: 'Añadir un libro por leer',
  markAsRead: 'Marcar como leído',
  whenDidYouGetIt: '¿Cuándo lo conseguiste?',
  toReadNotesPlaceholder: '¿Por qué quieres leerlo?',
  athsTitle: 'Añadir a la pantalla de inicio',
  athsAndroid: 'Instala para una experiencia completa',
  athsIosTap: 'Pulsa',
  athsIosThen: 'luego',
  athsInstall: 'Instalar',
}

const pl: Translations = {
  myBookshelf: 'Moja półka',
  loadingBookshelf: 'Ładowanie półki…',
  noBooks: 'Witaj na swojej półce!',
  addFirstBook: 'Śledź przeczytane przez siebie książki:',
  addFirstBookBullet1: '📘 Pamiętaj, co czytałeś',
  addFirstBookBullet2: '📘 Dodaj osobiste oceny',
  addFirstBookCta: 'Dodaj pierwszą książkę',
  settings: 'Ustawienia',
  addABook: 'Dodaj przeczytaną książkę',
  addBook: 'Dodaj',
  saveChanges: 'Zapisz zmiany',
  editBook: 'Edytuj książkę',
  changesSaved: 'Zmiany zapisane!',
  titleLabel: 'Tytuł',
  titlePlaceholder: 'Zacznij pisać, aby wyszukać…',
  authorLabel: 'Autor',
  authorPlaceholder: 'Wpisz imię autora...',
  whenDidYouRead: 'Kiedy to czytałeś?',
  unknownMonth: '— Nieznany miesiąc —',
  ratingLabel: 'Ocena',
  ratingLabels: ['Nie podobało mi się', 'Było okej', 'Podobało mi się', 'Bardzo mi się podobało', 'Kochałem to'],
  myNotesLabel: 'Moje notatki',
  notesPlaceholder: 'Co myślisz o tej książce?',
  coverPreview: 'Podgląd okładki',
  removeCover: 'Usuń okładkę',
  noNotesAdded: 'Brak notatek.',
  released: 'Wydano',
  genre: 'Gatunek',
  aboutTheBook: 'O książce',
  noDescriptionAvailable: 'Brak opisu.',
  loading: 'Ładowanie…',
  deleteBook: 'Usuń książkę',
  bookNotFound: 'Nie znaleziono książki',
  backToBookshelf: 'Wróć do półki',
  deleteDialogTitle: 'Usunąć tę książkę?',
  deleteDialogSuffix: 'zostanie trwale usunięta z twojej półki.',
  deleting: 'Usuwanie…',
  cancel: 'Anuluj',
  cozyMode: 'Tryb przytulny',
  cozyModeDescription: 'Tryb przytulny sprawia, że aplikacja wygląda jak ciepły salon!',
  language: 'Język',
  signOut: 'Wyloguj się',
  email: 'E-mail',
  password: 'Hasło',
  confirmPassword: 'Potwierdź hasło',
  signIn: 'Zaloguj się',
  signUp: 'Utwórz konto',
  signingIn: 'Logowanie…',
  signingUp: 'Tworzenie konta…',
  noAccount: 'Nie masz konta?',
  haveAccount: 'Masz już konto?',
  passwordMismatch: 'Hasła nie są zgodne.',
  checkYourEmail: 'Sprawdź swoją pocztę',
  checkYourEmailDesc: 'Wysłaliśmy Ci link potwierdzający. Kliknij go, aby aktywować konto, a następnie wróć, aby się zalogować.',
  backToSignIn: 'Wróć do logowania',
  loginTitle: 'Zaloguj się do swojej półki!',
  loginSubtitle: 'Śledź książki, które przeczytałeś!',
  signUpPageTitle: 'Utwórz swoje konto!',
  signUpPageSubtitle: 'Zacznij śledzić swoje lektury już dziś!',
  logIn: 'Zaloguj się',
  myAccount: 'Moje konto',
  changePassword: 'Zmień hasło',
  newPassword: 'Nowe hasło',
  confirmNewPassword: 'Potwierdź nowe hasło',
  savePassword: 'Zapisz hasło',
  savingPassword: 'Zapisywanie…',
  passwordChangedSuccess: 'Hasło zostało pomyślnie zmienione.',
  deleteAccount: 'Usuń konto',
  deleteAccountDesc: 'Twoje konto i wszystkie książki zostaną trwale usunięte. Tej operacji nie można cofnąć.',
  forgotPassword: 'Zapomniałeś hasła?',
  resetYourPassword: 'Zresetuj hasło',
  resetPasswordDesc: 'Podaj swój adres e-mail, a wyślemy Ci link do resetowania hasła.',
  sendResetLink: 'Wyślij link',
  sendingResetLink: 'Wysyłanie…',
  resetLinkSent: 'Sprawdź swoją pocztę',
  resetLinkSentDesc: 'Wysłaliśmy Ci link do resetowania hasła. Kliknij go, aby ustawić nowe hasło.',
  setNewPassword: 'Ustaw nowe hasło',
  setNewPasswordDesc: 'Wprowadź nowe hasło dla swojego konta.',
  passwordResetSuccess: 'Hasło zaktualizowane! Możesz się teraz zalogować.',
  readBooksTitle: 'Przeczytane książki',
  toReadBooksTitle: 'Książki do przeczytania',
  tabRead: 'Przeczytane',
  tabToRead: 'Do przeczytania',
  toReadEmptyTitle: 'Nieprzeczytane książki',
  toReadEmptyCopy: 'Dodaj książki, które już masz, ale jeszcze nie przeczytałeś… Tyle książek, tak mało czasu.',
  addToReadingList: 'Dodaj książkę do przeczytania',
  markAsRead: 'Oznacz jako przeczytane',
  whenDidYouGetIt: 'Kiedy ją dostałeś?',
  toReadNotesPlaceholder: 'Dlaczego chcesz to przeczytać?',
  athsTitle: 'Dodaj do ekranu głównego',
  athsAndroid: 'Zainstaluj dla pełnego doświadczenia',
  athsIosTap: 'Dotknij',
  athsIosThen: 'a następnie',
  athsInstall: 'Zainstaluj',
}

export const translations: Record<Locale, Translations> = { en, de, fr, es, pl }
