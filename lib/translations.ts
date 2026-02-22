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
  addFirstBookCta: string
  settings: string
  // Add / edit pages
  addABook: string
  addBook: string
  saveChanges: string
  editBook: string
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
}

const en: Translations = {
  myBookshelf: 'My bookshelf',
  loadingBookshelf: 'Loading your bookshelf…',
  noBooks: 'Never forget a great read',
  addFirstBook: 'Log every book you finish — with your rating, notes, and when you read it. Your shelf grows with you.',
  addFirstBookCta: 'Add my first book',
  settings: 'Settings',
  addABook: 'Add a book you read',
  addBook: 'Add Book',
  saveChanges: 'Save Changes',
  editBook: 'Edit book',
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
}

const de: Translations = {
  myBookshelf: 'Mein Bücherregal',
  loadingBookshelf: 'Bücherregal wird geladen…',
  noBooks: 'Dein Regal ist leer',
  addFirstBook: 'Füge ein Buch hinzu, das du gelesen hast.',
  addFirstBookCta: 'Erstes Buch hinzufügen',
  settings: 'Einstellungen',
  addABook: 'Buch hinzufügen',
  addBook: 'Hinzufügen',
  saveChanges: 'Änderungen speichern',
  editBook: 'Buch bearbeiten',
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
}

const fr: Translations = {
  myBookshelf: 'Ma bibliothèque',
  loadingBookshelf: 'Chargement…',
  noBooks: 'Votre étagère est vide',
  addFirstBook: 'Ajoutez un livre que vous avez lu pour commencer.',
  addFirstBookCta: 'Ajouter votre premier livre',
  settings: 'Paramètres',
  addABook: 'Ajouter un livre lu',
  addBook: 'Ajouter',
  saveChanges: 'Enregistrer',
  editBook: 'Modifier le livre',
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
}

const es: Translations = {
  myBookshelf: 'Mi estantería',
  loadingBookshelf: 'Cargando tu estantería…',
  noBooks: 'Tu estantería está vacía',
  addFirstBook: 'Añade un libro que hayas leído para empezar.',
  addFirstBookCta: 'Añadir tu primer libro',
  settings: 'Ajustes',
  addABook: 'Añadir un libro leído',
  addBook: 'Añadir',
  saveChanges: 'Guardar cambios',
  editBook: 'Editar libro',
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
}

const pl: Translations = {
  myBookshelf: 'Moja półka',
  loadingBookshelf: 'Ładowanie półki…',
  noBooks: 'Twoja półka jest pusta',
  addFirstBook: 'Dodaj książkę, którą przeczytałeś, aby zacząć.',
  addFirstBookCta: 'Dodaj pierwszą książkę',
  settings: 'Ustawienia',
  addABook: 'Dodaj przeczytaną książkę',
  addBook: 'Dodaj',
  saveChanges: 'Zapisz zmiany',
  editBook: 'Edytuj książkę',
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
}

export const translations: Record<Locale, Translations> = { en, de, fr, es, pl }
