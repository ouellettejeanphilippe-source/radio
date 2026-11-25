import { useState } from 'react'
import qrcode from 'qrcode-generator'
import {
  connectListenBrainz,
  disconnectLastfm,
  disconnectListenBrainz,
  lastfmKeys,
  setLastfmKeys,
  startLastfmLogin,
  useScrobbleSettings,
} from './scrobble.js'
import { deviceLink, disableSync, enableSync, syncNow, TOKEN_URL, useSync } from './sync.js'

function Qr({ text }) {
  const qr = qrcode(0, 'L')
  qr.addData(text)
  qr.make()
  return <div className="sync-qr" dangerouslySetInnerHTML={{ __html: qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true }) }} />
}

const timeLabel = (t) => new Date(t).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })

function Sync() {
  const { sync, busy, error } = useSync()
  const [token, setToken] = useState('')
  const [working, setWorking] = useState(false)
  const [setupError, setSetupError] = useState(null)
  const [showLink, setShowLink] = useState(false)
  const [copied, setCopied] = useState(false)

  if (!sync) {
    async function enable(e) {
      e.preventDefault()
      setWorking(true)
      setSetupError(null)
      try {
        await enableSync(token)
        setToken('')
      } catch (err) {
        setSetupError(err instanceof TypeError ? 'Pas de connexion à GitHub.' : err.message)
      } finally {
        setWorking(false)
      }
    }
    return (
      <form onSubmit={enable}>
        <p className="scrobble-help">
          Garde tes favoris, tes récents et ce que tu as déjà entendu pareils sur tous tes appareils, dans un gist secret de ton compte GitHub.
        </p>
        <ol className="sync-steps">
          <li>
            <a href={TOKEN_URL} target="_blank" rel="noreferrer">
              Ouvre cette page GitHub
            </a>
            , choisis « No expiration », puis clique « Generate token » en bas.
          </li>
          <li>Copie le jeton et colle-le ici :</li>
        </ol>
        <div className="scrobble-field">
          <input type="password" aria-label="Jeton GitHub" placeholder="ghp_…" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" />
          <button className="scrobble-btn" disabled={!token.trim() || working}>
            {working ? '…' : 'Activer'}
          </button>
        </div>
        <p className="scrobble-help">Sur tes autres appareils, tu n'auras qu'à ouvrir un lien.</p>
        {setupError && <p className="error">{setupError}</p>}
      </form>
    )
  }

  const link = showLink && deviceLink()
  return (
    <>
      <div className="scrobble-row">
        <span>
          Activée{sync.user && <> ({sync.user})</>} · {busy ? 'synchro…' : sync.last ? `dernière synchro ${timeLabel(sync.last)}` : 'pas encore de synchro'}
        </span>
        <button className="btn-link" onClick={syncNow} disabled={busy}>
          Synchroniser
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      {link ? (
        <div className="sync-link">
          <p className="scrobble-help">Scanne ce code avec l'autre appareil, ou envoie-toi le lien. Il contient ton jeton : garde-le pour toi.</p>
          <Qr text={link} />
          <button
            className="scrobble-btn scrobble-btn--wide"
            onClick={async () => {
              try {
                if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ title: 'Radio', url: link })
                else {
                  await navigator.clipboard.writeText(link)
                  setCopied(true)
                }
              } catch {
                // Share sheet closed.
              }
            }}
          >
            {copied ? 'Lien copié ✓' : 'Copier / partager le lien'}
          </button>
        </div>
      ) : (
        <button className="scrobble-btn scrobble-btn--wide sync-add" onClick={() => setShowLink(true)}>
          Ajouter un autre appareil
        </button>
      )}
      <button className="btn-link" onClick={disableSync}>
        Désactiver sur cet appareil
      </button>
    </>
  )
}

function ListenBrainz({ settings }) {
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  if (settings.lbToken) {
    return (
      <div className="scrobble-row">
        <span>
          Connecté : <b>{settings.lbUser}</b>
        </span>
        <button className="btn-link" onClick={disconnectListenBrainz}>
          Déconnecter
        </button>
      </div>
    )
  }
  async function connect(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await connectListenBrainz(token)
      setToken('')
    } catch (err) {
      setError(err instanceof TypeError ? 'Pas de connexion à ListenBrainz.' : err.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={connect}>
      <p className="scrobble-help">
        Copie ton jeton sur{' '}
        <a href="https://listenbrainz.org/settings/" target="_blank" rel="noreferrer">
          listenbrainz.org/settings
        </a>{' '}
        puis colle-le ici.
      </p>
      <div className="scrobble-field">
        <input type="password" aria-label="Jeton ListenBrainz" placeholder="Jeton ListenBrainz" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" />
        <button className="scrobble-btn" disabled={!token.trim() || busy}>
          {busy ? '…' : 'Connecter'}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </form>
  )
}

function Lastfm({ settings }) {
  const keys = lastfmKeys(settings)
  const hasKeys = Boolean(keys.key && keys.secret)
  const [showKeys, setShowKeys] = useState(!hasKeys)
  const [key, setKey] = useState(settings.lfmKey ?? '')
  const [secret, setSecret] = useState(settings.lfmSecret ?? '')
  return (
    <>
      {settings.lfmSession ? (
        <div className="scrobble-row">
          <span>
            Connecté : <b>{settings.lfmUser}</b>
          </span>
          <button className="btn-link" onClick={disconnectLastfm}>
            Déconnecter
          </button>
        </div>
      ) : (
        <button className="scrobble-btn scrobble-btn--wide" onClick={startLastfmLogin} disabled={!hasKeys}>
          Connecter Last.fm
        </button>
      )}
      {showKeys ? (
        <form
          className="scrobble-keys"
          onSubmit={(e) => {
            e.preventDefault()
            setLastfmKeys(key, secret)
            if (key.trim() && secret.trim()) setShowKeys(false)
          }}
        >
          <p className="scrobble-help">
            Last.fm demande une clé d'application. Crée-la sur{' '}
            <a href="https://www.last.fm/api/account/create" target="_blank" rel="noreferrer">
              last.fm/api/account/create
            </a>{' '}
            (le nom et la description importent peu, laisse l'URL de rappel vide), puis copie la clé et le secret ici.
          </p>
          <input aria-label="Clé API Last.fm" placeholder="Clé API" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" />
          <input type="password" aria-label="Secret partagé Last.fm" placeholder="Secret partagé" value={secret} onChange={(e) => setSecret(e.target.value)} autoComplete="off" />
          <button className="scrobble-btn">Enregistrer</button>
        </form>
      ) : (
        !settings.lfmSession && (
          <button className="btn-link" onClick={() => setShowKeys(true)}>
            Utiliser ma propre clé API
          </button>
        )
      )}
    </>
  )
}

export default function Settings({ count, total, lastStatus, onClose }) {
  const settings = useScrobbleSettings()
  return (
    <div className="wheel-backdrop" onClick={onClose}>
      <div className="scrobble-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Réglages">
        <div className="scrobble-head">
          <h2>Réglages</h2>
          <button className="btn-link" onClick={onClose}>
            Fermer
          </button>
        </div>
        <section>
          <h3>Synchro entre appareils</h3>
          <Sync />
        </section>
        <h2 className="settings-title">Scrobbling</h2>
        <p className="scrobble-help">
          Envoie les chansons que tu écoutes à ton profil. Seules les stations avec la liste des chansons comptent ({count} sur {total}), et pas les
          pubs ni les DJ. Une chanson est comptée après la moitié (ou 4 minutes) écoutée.
        </p>
        <section>
          <h3>ListenBrainz</h3>
          <ListenBrainz settings={settings} />
        </section>
        <section>
          <h3>Last.fm</h3>
          <Lastfm settings={settings} />
        </section>
        {lastStatus?.state === 'error' && <p className="error">{lastStatus.error}</p>}
        {lastStatus?.state === 'done' && (
          <p className="scrobble-help">
            Dernière envoyée : {lastStatus.song.artist} - {lastStatus.song.track}
          </p>
        )}
      </div>
    </div>
  )
}
