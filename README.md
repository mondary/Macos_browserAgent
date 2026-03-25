# Codex Browser Agent

![Project icon](icon.png)

[🇫🇷 FR](README.md) · [🇬🇧 EN](README_en.md)

Extension Chrome MV3 avec panneau latéral qui envoie des requêtes en langage naturel à un bridge local utilisant Codex CLI pour automatiser les actions du navigateur.

## ✅ Fonctionnalités

- Panneau latéral Chrome intégré pour les requêtes en langage naturel
- Bridge HTTP local communiquant avec Codex CLI
- Capture DOM + screenshot pour l'analyse de page
- Orchestration jusqu'à 8 étapes de raisonnement par requête
- Support des sites complexes (Gmail, applications web)
- Configuration flexible via variables d'environnement

## 🧠 Utilisation

### Démarrer le bridge

```bash
npm run start:bridge
```

Variables d'environnement optionnelles :

```bash
BRIDGE_HOST=127.0.0.1
BRIDGE_PORT=7823
CODEX_BIN=codex
CODEX_MODEL=gpt-5.4
```

### Charger l'extension Chrome

1. Ouvrir `chrome://extensions`
2. Activer le **Mode développeur**
3. Cliquer sur **Charger l'extension non empaquetée**
4. Sélectionner le dossier `extension/`
5. Épingler l'extension pour un accès rapide
6. Cliquer sur l'extension pour ouvrir le panneau latéral

### Exemples de requêtes

- `Lit les 5 premiers fils de discussion visibles et donne-moi un résumé.`
- `Ouvre le premier résultat sur cette page.`
- `Défile jusqu'à trouver les tarifs, puis résume-les.`
- `Clique sur le bouton "S'inscrire" et remplis le formulaire.`

## 🧠 Architecture

```
extension/
├── manifest.json           # Configuration MV3
├── background.js           # Service worker
├── content-script.js       # Analyse DOM
├── sidepanel.js/html/css   # Interface utilisateur

bridge/
├── server.mjs              # Serveur HTTP local
├── agent-schema.json       # Schéma de configuration
```

## ⚙️ Configuration

Le bridge écoute par défaut sur `127.0.0.1:7823` (localhost uniquement).

Variables disponibles :
- `BRIDGE_HOST` : Hôte d'écoute (défaut: 127.0.0.1)
- `BRIDGE_PORT` : Port d'écoute (défaut: 7823)
- `CODEX_BIN` : Binaire Codex (défaut: codex)
- `CODEX_MODEL` : Modèle à utiliser (défaut: vide)

## ⚠️ Limitations

- Fonctionne uniquement sur les pages où les content scripts sont autorisés
- Utilise un snapshot DOM compact + screenshot, pas une automatisation complète du navigateur
- Le panneau latéral orchestre jusqu'à 8 étapes de raisonnement par requête
- Gmail et autres applications complexes peuvent nécessiter des itérations pour une fiabilité optimale

## 🧾 Changelog

### 0.1.0
- Version initiale
- Support du panneau latéral Chrome
- Bridge HTTP local avec Codex CLI
- Capture DOM + screenshot
- Orchestration multi-étapes

## 🔗 Liens

- [EN README](README_en.md)
- Codex CLI : https://github.com/anthropics/codex
- Issue Tracker : https://github.com/votre-username/macos-browser-agent/issues
