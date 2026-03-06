export const SUPPORTED_LOCALES = ['en', 'el', 'es', 'de', 'fr', 'ja', 'zh', 'pt', 'ru'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const LOCALE_NAMES: Record<Locale, string> = {
	en: 'English',
	el: 'Ελληνικά',
	es: 'Español',
	de: 'Deutsch',
	fr: 'Français',
	ja: '日本語',
	zh: '中文',
	pt: 'Português',
	ru: 'Русский'
};

type Translations = {
	nav_features: string;
	nav_download: string;
	hero_badge: string;
	hero_title_1: string;
	hero_title_2: string;
	hero_sub: string;
	hero_download: string;
	hero_github: string;
	hero_also: string;
	hero_and: string;
	features_heading: string;
	features_sub: string;
	feat_encrypted_title: string;
	feat_encrypted_desc: string;
	feat_notrack_title: string;
	feat_notrack_desc: string;
	feat_voice_title: string;
	feat_voice_desc: string;
	feat_servers_title: string;
	feat_servers_desc: string;
	feat_fast_title: string;
	feat_fast_desc: string;
	feat_oss_title: string;
	feat_oss_desc: string;
	tech_powered: string;
	download_heading: string;
	download_sub: string;
	download_loading: string;
	download_empty: string;
	download_notes: string;
	download_latest: string;
	download_check: string;
	footer_copy: string;
};

const en: Translations = {
	nav_features: 'Features',
	nav_download: 'Download',
	hero_badge: 'Open Source & Free Forever',
	hero_title_1: 'Talk. Connect.',
	hero_title_2: 'Own your privacy.',
	hero_sub: "The communication platform that doesn't spy on you. End-to-end encrypted, zero tracking, built with Rust.",
	hero_download: 'Download for',
	hero_github: 'View on GitHub',
	hero_also: 'Also available for',
	hero_and: 'and',
	features_heading: 'Built different.',
	features_sub: 'Everything you expect from a modern chat platform — without the surveillance.',
	feat_encrypted_title: 'End-to-End Encrypted',
	feat_encrypted_desc: "Every message, every call. Your conversations stay yours — not ours, not anyone's.",
	feat_notrack_title: 'Zero Data Collection',
	feat_notrack_desc: 'No telemetry, no analytics, no ads. We don\'t track you, profile you, or sell your data. Ever.',
	feat_voice_title: 'Crystal Voice & Video',
	feat_voice_desc: 'Voice channels, video calls, and screen sharing powered by LiveKit. Low latency, high fidelity.',
	feat_servers_title: 'Servers & Roles',
	feat_servers_desc: 'Create communities with channels, categories, permissions, and role-based access control.',
	feat_fast_title: 'Blazing Fast',
	feat_fast_desc: 'Built with Tauri and Rust. Native performance, tiny footprint — not another Electron wrapper.',
	feat_oss_title: 'Open Source',
	feat_oss_desc: 'MIT licensed. Audit the code, fork it, contribute. Transparency is not optional.',
	tech_powered: 'Powered by',
	download_heading: 'Get ZeusIX',
	download_sub: 'Download the latest build for your platform. All releases are signed and verified.',
	download_loading: 'Loading releases...',
	download_empty: 'No releases found.',
	download_notes: 'Release notes',
	download_latest: 'Latest',
	download_check: 'Check GitHub Releases',
	footer_copy: 'Built with obsession. Open source, forever.'
};

const el: Translations = {
	nav_features: 'Χαρακτηριστικά',
	nav_download: 'Λήψη',
	hero_badge: 'Ανοιχτός κώδικας & δωρεάν για πάντα',
	hero_title_1: 'Μίλα. Συνδέσου.',
	hero_title_2: 'Προστάτεψε το απόρρητό σου.',
	hero_sub: 'Η πλατφόρμα επικοινωνίας που δεν σε κατασκοπεύει. Κρυπτογράφηση από άκρη σε άκρη, μηδενική παρακολούθηση, χτισμένη με Rust.',
	hero_download: 'Κατέβασε για',
	hero_github: 'Δες το στο GitHub',
	hero_also: 'Διαθέσιμο επίσης για',
	hero_and: 'και',
	features_heading: 'Φτιαγμένο αλλιώς.',
	features_sub: 'Όλα όσα περιμένεις από μια σύγχρονη πλατφόρμα επικοινωνίας — χωρίς την παρακολούθηση.',
	feat_encrypted_title: 'Κρυπτογράφηση από άκρη σε άκρη',
	feat_encrypted_desc: 'Κάθε μήνυμα, κάθε κλήση. Οι συνομιλίες σου παραμένουν μόνο δικές σου — όχι δικές μας, ούτε κανενός.',
	feat_notrack_title: 'Μηδενική συλλογή δεδομένων',
	feat_notrack_desc: 'Χωρίς telemetry, χωρίς analytics, χωρίς διαφημίσεις. Δεν σε παρακολουθούμε, δεν σε αναλύουμε, δεν πουλάμε τα δεδομένα σου. Ποτέ.',
	feat_voice_title: 'Κρυστάλλινη φωνή και βίντεο',
	feat_voice_desc: 'Κανάλια φωνής, βιντεοκλήσεις και κοινή χρήση οθόνης μέσω LiveKit. Χαμηλή καθυστέρηση, υψηλή πιστότητα.',
	feat_servers_title: 'Servers και ρόλοι',
	feat_servers_desc: 'Δημιούργησε κοινότητες με κανάλια, κατηγορίες, δικαιώματα και έλεγχο πρόσβασης βάσει ρόλων.',
	feat_fast_title: 'Αστραπιαία ταχύτητα',
	feat_fast_desc: 'Χτισμένο με Tauri και Rust. Εγγενής απόδοση, ελάχιστο αποτύπωμα — όχι ακόμα ένα Electron wrapper.',
	feat_oss_title: 'Ανοιχτός κώδικας',
	feat_oss_desc: 'Άδεια MIT. Έλεγξε τον κώδικα, κάνε fork, συνεισφέρε. Η διαφάνεια δεν είναι προαιρετική.',
	tech_powered: 'Τρέχει με',
	download_heading: 'Κατέβασε το ZeusIX',
	download_sub: 'Κατέβασε την τελευταία έκδοση για την πλατφόρμα σου. Όλες οι εκδόσεις είναι υπογεγραμμένες και επαληθευμένες.',
	download_loading: 'Φόρτωση εκδόσεων...',
	download_empty: 'Δεν βρέθηκαν εκδόσεις.',
	download_notes: 'Σημειώσεις έκδοσης',
	download_latest: 'Τελευταία',
	download_check: 'Δες τις εκδόσεις στο GitHub',
	footer_copy: 'Φτιαγμένο με εμμονή. Ανοιχτός κώδικας, για πάντα.'
};

const es: Translations = {
	nav_features: 'Funciones',
	nav_download: 'Descargar',
	hero_badge: 'Codigo abierto y gratis para siempre',
	hero_title_1: 'Habla. Conecta.',
	hero_title_2: 'Tu privacidad es tuya.',
	hero_sub: 'La plataforma de comunicacion que no te espia. Cifrada de extremo a extremo, cero rastreo, construida con Rust.',
	hero_download: 'Descargar para',
	hero_github: 'Ver en GitHub',
	hero_also: 'Tambien disponible para',
	hero_and: 'y',
	features_heading: 'Diferente por diseno.',
	features_sub: 'Todo lo que esperas de una plataforma de chat moderna — sin la vigilancia.',
	feat_encrypted_title: 'Cifrado de extremo a extremo',
	feat_encrypted_desc: 'Cada mensaje, cada llamada. Tus conversaciones son tuyas — no nuestras, ni de nadie.',
	feat_notrack_title: 'Cero recoleccion de datos',
	feat_notrack_desc: 'Sin telemetria, sin analytics, sin anuncios. No te rastreamos, no te perfilamos, no vendemos tus datos. Nunca.',
	feat_voice_title: 'Voz y video cristalinos',
	feat_voice_desc: 'Canales de voz, videollamadas y pantalla compartida con LiveKit. Baja latencia, alta fidelidad.',
	feat_servers_title: 'Servidores y roles',
	feat_servers_desc: 'Crea comunidades con canales, categorias, permisos y control de acceso basado en roles.',
	feat_fast_title: 'Ultrarapido',
	feat_fast_desc: 'Construido con Tauri y Rust. Rendimiento nativo, huella minima — no es otro wrapper de Electron.',
	feat_oss_title: 'Codigo abierto',
	feat_oss_desc: 'Licencia MIT. Audita el codigo, haz un fork, contribuye. La transparencia no es opcional.',
	tech_powered: 'Impulsado por',
	download_heading: 'Obtener ZeusIX',
	download_sub: 'Descarga la ultima version para tu plataforma. Todas las versiones estan firmadas y verificadas.',
	download_loading: 'Cargando versiones...',
	download_empty: 'No se encontraron versiones.',
	download_notes: 'Notas de la version',
	download_latest: 'Ultima',
	download_check: 'Ver versiones en GitHub',
	footer_copy: 'Construido con obsesion. Codigo abierto, para siempre.'
};

const de: Translations = {
	nav_features: 'Funktionen',
	nav_download: 'Download',
	hero_badge: 'Open Source & fur immer kostenlos',
	hero_title_1: 'Sprich. Verbinde.',
	hero_title_2: 'Deine Privatsphare.',
	hero_sub: 'Die Kommunikationsplattform, die dich nicht ausspioniert. Ende-zu-Ende verschlusselt, kein Tracking, mit Rust gebaut.',
	hero_download: 'Download fur',
	hero_github: 'Auf GitHub ansehen',
	hero_also: 'Auch verfugbar fur',
	hero_and: 'und',
	features_heading: 'Anders gebaut.',
	features_sub: 'Alles, was du von einer modernen Chat-Plattform erwartest — ohne Uberwachung.',
	feat_encrypted_title: 'Ende-zu-Ende verschlusselt',
	feat_encrypted_desc: 'Jede Nachricht, jeder Anruf. Deine Gesprache bleiben deine — nicht unsere.',
	feat_notrack_title: 'Keine Datensammlung',
	feat_notrack_desc: 'Keine Telemetrie, keine Analyse, keine Werbung. Wir tracken dich nicht, profilieren dich nicht, verkaufen deine Daten nicht. Niemals.',
	feat_voice_title: 'Kristallklare Sprache & Video',
	feat_voice_desc: 'Sprachkanale, Videoanrufe und Bildschirmfreigabe mit LiveKit. Geringe Latenz, hohe Qualitat.',
	feat_servers_title: 'Server & Rollen',
	feat_servers_desc: 'Erstelle Communities mit Kanalen, Kategorien, Berechtigungen und rollenbasierter Zugriffskontrolle.',
	feat_fast_title: 'Blitzschnell',
	feat_fast_desc: 'Mit Tauri und Rust gebaut. Native Performance, minimaler Ressourcenverbrauch.',
	feat_oss_title: 'Open Source',
	feat_oss_desc: 'MIT-Lizenz. Prufe den Code, forke ihn, trage bei. Transparenz ist nicht optional.',
	tech_powered: 'Angetrieben von',
	download_heading: 'ZeusIX herunterladen',
	download_sub: 'Lade die neueste Version fur deine Plattform herunter. Alle Releases sind signiert und verifiziert.',
	download_loading: 'Releases werden geladen...',
	download_empty: 'Keine Releases gefunden.',
	download_notes: 'Release-Notizen',
	download_latest: 'Neueste',
	download_check: 'GitHub Releases ansehen',
	footer_copy: 'Mit Leidenschaft gebaut. Open Source, fur immer.'
};

const fr: Translations = {
	nav_features: 'Fonctionnalites',
	nav_download: 'Telecharger',
	hero_badge: 'Open source et gratuit pour toujours',
	hero_title_1: 'Parlez. Connectez.',
	hero_title_2: 'Votre vie privee.',
	hero_sub: "La plateforme de communication qui ne vous espionne pas. Chiffree de bout en bout, zero tracking, construite avec Rust.",
	hero_download: 'Telecharger pour',
	hero_github: 'Voir sur GitHub',
	hero_also: 'Aussi disponible pour',
	hero_and: 'et',
	features_heading: 'Construit differemment.',
	features_sub: 'Tout ce que vous attendez d\'une plateforme de chat moderne — sans la surveillance.',
	feat_encrypted_title: 'Chiffrement bout en bout',
	feat_encrypted_desc: 'Chaque message, chaque appel. Vos conversations restent les votres.',
	feat_notrack_title: 'Zero collecte de donnees',
	feat_notrack_desc: 'Pas de telemetrie, pas d\'analytics, pas de pub. On ne vous traque pas, on ne vous profile pas, on ne vend pas vos donnees. Jamais.',
	feat_voice_title: 'Voix et video cristallines',
	feat_voice_desc: 'Canaux vocaux, appels video et partage d\'ecran avec LiveKit. Faible latence, haute fidelite.',
	feat_servers_title: 'Serveurs et roles',
	feat_servers_desc: 'Creez des communautes avec des canaux, categories, permissions et controle d\'acces base sur les roles.',
	feat_fast_title: 'Ultra rapide',
	feat_fast_desc: 'Construit avec Tauri et Rust. Performance native, empreinte minimale.',
	feat_oss_title: 'Open source',
	feat_oss_desc: 'Licence MIT. Auditez le code, forkez-le, contribuez. La transparence n\'est pas optionnelle.',
	tech_powered: 'Propulse par',
	download_heading: 'Obtenir ZeusIX',
	download_sub: 'Telechargez la derniere version pour votre plateforme. Toutes les versions sont signees et verifiees.',
	download_loading: 'Chargement des versions...',
	download_empty: 'Aucune version trouvee.',
	download_notes: 'Notes de version',
	download_latest: 'Derniere',
	download_check: 'Voir les versions sur GitHub',
	footer_copy: 'Construit avec obsession. Open source, pour toujours.'
};

const ja: Translations = {
	nav_features: '機能',
	nav_download: 'ダウンロード',
	hero_badge: 'オープンソース＆永久無料',
	hero_title_1: '話す。つながる。',
	hero_title_2: 'プライバシーを守る。',
	hero_sub: 'あなたを監視しないコミュニケーションプラットフォーム。エンドツーエンド暗号化、トラッキングゼロ、Rustで構築。',
	hero_download: 'ダウンロード：',
	hero_github: 'GitHubで見る',
	hero_also: '他のプラットフォームも利用可能：',
	hero_and: 'と',
	features_heading: '違いを感じる。',
	features_sub: 'モダンなチャットプラットフォームに期待するすべて — 監視なしで。',
	feat_encrypted_title: 'エンドツーエンド暗号化',
	feat_encrypted_desc: 'すべてのメッセージ、すべての通話。あなたの会話はあなただけのもの。',
	feat_notrack_title: 'データ収集ゼロ',
	feat_notrack_desc: 'テレメトリなし、アナリティクスなし、広告なし。追跡もプロファイリングもデータ販売も一切しません。',
	feat_voice_title: 'クリスタルボイス＆ビデオ',
	feat_voice_desc: 'LiveKitによるボイスチャンネル、ビデオ通話、画面共有。低遅延、高品質。',
	feat_servers_title: 'サーバーとロール',
	feat_servers_desc: 'チャンネル、カテゴリ、権限、ロールベースのアクセス制御でコミュニティを構築。',
	feat_fast_title: '超高速',
	feat_fast_desc: 'TauriとRustで構築。ネイティブパフォーマンス、最小フットプリント。',
	feat_oss_title: 'オープンソース',
	feat_oss_desc: 'MITライセンス。コードを監査し、フォークし、貢献。透明性は選択肢ではない。',
	tech_powered: '技術スタック',
	download_heading: 'ZeusIXを入手',
	download_sub: 'お使いのプラットフォーム向けの最新ビルドをダウンロード。すべてのリリースは署名・検証済み。',
	download_loading: 'リリースを読み込み中...',
	download_empty: 'リリースが見つかりません。',
	download_notes: 'リリースノート',
	download_latest: '最新',
	download_check: 'GitHubリリースを確認',
	footer_copy: '情熱で構築。永遠にオープンソース。'
};

const zh: Translations = {
	nav_features: '功能',
	nav_download: '下载',
	hero_badge: '开源且永久免费',
	hero_title_1: '交流。连接。',
	hero_title_2: '掌控你的隐私。',
	hero_sub: '不窥探你的通讯平台。端到端加密，零追踪，Rust构建。',
	hero_download: '下载',
	hero_github: '在GitHub上查看',
	hero_also: '也适用于',
	hero_and: '和',
	features_heading: '与众不同。',
	features_sub: '现代聊天平台应有的一切——无需被监控。',
	feat_encrypted_title: '端到端加密',
	feat_encrypted_desc: '每条消息，每次通话。你的对话只属于你。',
	feat_notrack_title: '零数据收集',
	feat_notrack_desc: '无遥测、无分析、无广告。我们不追踪你、不分析你、不出售你的数据。永远不会。',
	feat_voice_title: '清晰语音与视频',
	feat_voice_desc: 'LiveKit驱动的语音频道、视频通话和屏幕共享。低延迟，高保真。',
	feat_servers_title: '服务器与角色',
	feat_servers_desc: '通过频道、分类、权限和基于角色的访问控制创建社区。',
	feat_fast_title: '极速',
	feat_fast_desc: '使用Tauri和Rust构建。原生性能，极小体积。',
	feat_oss_title: '开源',
	feat_oss_desc: 'MIT许可。审查代码，Fork，贡献。透明不是可选的。',
	tech_powered: '技术驱动',
	download_heading: '获取ZeusIX',
	download_sub: '下载适合你平台的最新版本。所有版本均已签名验证。',
	download_loading: '加载版本中...',
	download_empty: '未找到版本。',
	download_notes: '版本说明',
	download_latest: '最新',
	download_check: '查看GitHub版本',
	footer_copy: '以热情构建。永远开源。'
};

const pt: Translations = {
	nav_features: 'Recursos',
	nav_download: 'Download',
	hero_badge: 'Codigo aberto e gratuito para sempre',
	hero_title_1: 'Fale. Conecte.',
	hero_title_2: 'Sua privacidade.',
	hero_sub: 'A plataforma de comunicacao que nao te espiona. Criptografia ponta a ponta, zero rastreamento, construida com Rust.',
	hero_download: 'Download para',
	hero_github: 'Ver no GitHub',
	hero_also: 'Tambem disponivel para',
	hero_and: 'e',
	features_heading: 'Construido diferente.',
	features_sub: 'Tudo que voce espera de uma plataforma de chat moderna — sem vigilancia.',
	feat_encrypted_title: 'Criptografia ponta a ponta',
	feat_encrypted_desc: 'Cada mensagem, cada chamada. Suas conversas sao suas — nao nossas.',
	feat_notrack_title: 'Zero coleta de dados',
	feat_notrack_desc: 'Sem telemetria, sem analytics, sem anuncios. Nao rastreamos, nao perfilamos, nao vendemos seus dados. Nunca.',
	feat_voice_title: 'Voz e video cristalinos',
	feat_voice_desc: 'Canais de voz, videochamadas e compartilhamento de tela com LiveKit. Baixa latencia, alta fidelidade.',
	feat_servers_title: 'Servidores e cargos',
	feat_servers_desc: 'Crie comunidades com canais, categorias, permissoes e controle de acesso baseado em cargos.',
	feat_fast_title: 'Ultrarapido',
	feat_fast_desc: 'Construido com Tauri e Rust. Performance nativa, pegada minima.',
	feat_oss_title: 'Codigo aberto',
	feat_oss_desc: 'Licenca MIT. Audite o codigo, faca fork, contribua. Transparencia nao e opcional.',
	tech_powered: 'Desenvolvido com',
	download_heading: 'Obter ZeusIX',
	download_sub: 'Baixe a versao mais recente para sua plataforma. Todos os lancamentos sao assinados e verificados.',
	download_loading: 'Carregando versoes...',
	download_empty: 'Nenhuma versao encontrada.',
	download_notes: 'Notas da versao',
	download_latest: 'Mais recente',
	download_check: 'Ver versoes no GitHub',
	footer_copy: 'Construido com obsessao. Codigo aberto, para sempre.'
};

const ru: Translations = {
	nav_features: 'Возможности',
	nav_download: 'Скачать',
	hero_badge: 'Открытый исходный код и бесплатно навсегда',
	hero_title_1: 'Общайтесь.',
	hero_title_2: 'Защитите приватность.',
	hero_sub: 'Платформа общения, которая не следит за вами. Сквозное шифрование, нулевое отслеживание, построена на Rust.',
	hero_download: 'Скачать для',
	hero_github: 'Смотреть на GitHub',
	hero_also: 'Также доступно для',
	hero_and: 'и',
	features_heading: 'Создано иначе.',
	features_sub: 'Все, что вы ожидаете от современного чата — без слежки.',
	feat_encrypted_title: 'Сквозное шифрование',
	feat_encrypted_desc: 'Каждое сообщение, каждый звонок. Ваши разговоры остаются вашими.',
	feat_notrack_title: 'Нулевой сбор данных',
	feat_notrack_desc: 'Никакой телеметрии, аналитики, рекламы. Мы не отслеживаем вас, не профилируем, не продаем ваши данные. Никогда.',
	feat_voice_title: 'Кристальный голос и видео',
	feat_voice_desc: 'Голосовые каналы, видеозвонки и демонстрация экрана на LiveKit. Низкая задержка, высокое качество.',
	feat_servers_title: 'Серверы и роли',
	feat_servers_desc: 'Создавайте сообщества с каналами, категориями, разрешениями и ролевым управлением.',
	feat_fast_title: 'Молниеносно',
	feat_fast_desc: 'Построен на Tauri и Rust. Нативная производительность, минимальный размер.',
	feat_oss_title: 'Открытый исходный код',
	feat_oss_desc: 'Лицензия MIT. Проверяйте код, форкайте, вносите вклад. Прозрачность обязательна.',
	tech_powered: 'Работает на',
	download_heading: 'Получить ZeusIX',
	download_sub: 'Скачайте последнюю сборку для вашей платформы. Все релизы подписаны и проверены.',
	download_loading: 'Загрузка релизов...',
	download_empty: 'Релизы не найдены.',
	download_notes: 'Примечания к релизу',
	download_latest: 'Последний',
	download_check: 'Смотреть релизы на GitHub',
	footer_copy: 'Создано с одержимостью. Открытый исходный код, навсегда.'
};

const translations: Record<Locale, Translations> = { en, el, es, de, fr, ja, zh, pt, ru };

export function detectLocale(): Locale {
	if (typeof navigator === 'undefined') return 'en';
	const lang = (navigator.language || '').toLowerCase();
	for (const loc of SUPPORTED_LOCALES) {
		if (lang.startsWith(loc)) return loc;
	}
	return 'en';
}

export function t(locale: Locale): Translations {
	return translations[locale] || translations.en;
}
