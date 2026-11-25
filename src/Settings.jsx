import { useRef, useState } from 'react'
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
import ConfirmButton from './Confirm.jsx'

const OFFLINE = 'Vérifie ton réseau et réessaie.'
// Tokens and keys are pasted, never typed: no autocorrect, capitals or spellcheck on them.
const PASTED = { autoComplete: 'off', autoCapitalize: 'none', autoCorrect: 'off', spellCheck: false }

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
  const field = useRef(null)

  if (!sync) {
    async function enable(e) {
      e.preventDefault()
      if (!token.trim()) {
        setSetupError("Colle d'abord ton jeton GitHub dans le champ.")
        field.current.focus()
        return
      }
      setWorking(true)
      setSetupError(null)
      try {
        await enableSync(token)
        setToken('')
      } catch (err) {
        setSetupError(err instanceof TypeError ? `Pas de connexion à GitHub. ${OFFLINE}` : err.message)
        field.current?.focus()
      } finally {
        setWorking(false)
      }
    }
    return (
      <form onSubmit={enable}>
        <p className="scrobble-help">
          Garde tes favoris, tes récents, tes réglages d'écoute et ce que tu as déjà entendu pareils sur tous tes appareils, dans un gist secret de ton
          compte GitHub.
        </p>
        <ol className="sync-steps">
          <li>
            <a href={TOKEN_URL} target="_blank" rel="noreferrer">
              Ouvre cette page GitHub
            </a>
            , choisis «&nbsp;No expiration&nbsp;», puis clique «&nbsp;Generate token&nbsp;» en bas.
          </li>
          <li>Copie le jeton et colle-le ici&nbsp;:</li>
        </ol>
        <div className="scrobble-field">
          <input
            ref={field}
            type="password"
            name="github-token"
            aria-label="Jeton GitHub"
            placeholder="ghp_…"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            {...PASTED}
          />
          <button className="scrobble-btn" disabled={working}>
            {working ? '…' : 'Activer'}
          </button>
        </div>
        {setupError && (
          <p className="error" role="alert">
            {setupError}
          </p>
        )}
        <p className="scrobble-help">Sur tes autres appareils, tu n'auras qu'à ouvrir un lien.</p>
      </form>
    )
  }

  const link = showLink && deviceLink()
  return (
    <>
      <div className="scrobble-row">
        <span role="status">
          Activée{sync.user && <> ({sync.user})</>} · {busy ? 'synchro…' : sync.last ? `dernière synchro ${timeLabel(sync.last)}` : 'pas encore de synchro'}
        </span>
        <button className="btn-link" onClick={syncNow} disabled={busy}>
          Synchroniser
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {link ? (
        <div className="sync-link">
          <p className="scrobble-help">Scanne ce code avec l'autre appareil, ou envoie-toi le lien. Il contient ton jeton&nbsp;: garde-le pour toi.</p>
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
      <ConfirmButton onConfirm={disableSync}>Désactiver sur cet appareil</ConfirmButton>
    </>
  )
}

function ListenBrainz({ settings }) {
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const field = useRef(null)
  if (settings.lbToken) {
    return (
      <div className="scrobble-row">
        <span>
          Connecté&nbsp;: <b>{settings.lbUser}</b>
        </span>
        <ConfirmButton onConfirm={disconnectListenBrainz}>Déconnecter</ConfirmButton>
      </div>
    )
  }
  async function connect(e) {
    e.preventDefault()
    if (!token.trim()) {
      setError("Colle d'abord ton jeton ListenBrainz dans le champ.")
      field.current.focus()
      return
    }
    setBusy(true)
    setError(null)
    try {
      await connectListenBrainz(token)
      setToken('')
    } catch (err) {
      setError(err instanceof TypeError ? `Pas de connexion à ListenBrainz. ${OFFLINE}` : err.message)
      field.current?.focus()
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
        <input
          ref={field}
          type="password"
          name="listenbrainz-token"
          aria-label="Jeton ListenBrainz"
          placeholder="Jeton ListenBrainz…"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          {...PASTED}
        />
        <button className="scrobble-btn" disabled={busy}>
          {busy ? '…' : 'Connecter'}
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}

function Lastfm({ settings }) {
  const keys = lastfmKeys(settings)
  const hasKeys = Boolean(keys.key && keys.secret)
  const [showKeys, setShowKeys] = useState(!hasKeys)
  const [key, setKey] = useState(settings.lfmKey ?? '')
  const [secret, setSecret] = useState(settings.lfmSecret ?? '')
  const [missing, setMissing] = useState(false)
  const keyField = useRef(null)
  function connect() {
    if (hasKeys) return startLastfmLogin()
    setMissing(true)
    setShowKeys(true)
    keyField.current?.focus()
  }
  return (
    <>
      {settings.lfmSession ? (
        <div className="scrobble-row">
          <span>
            Connecté&nbsp;: <b>{settings.lfmUser}</b>
          </span>
          <ConfirmButton onConfirm={disconnectLastfm}>Déconnecter</ConfirmButton>
        </div>
      ) : (
        <button className="scrobble-btn scrobble-btn--wide" onClick={connect}>
          Connecter Last.fm
        </button>
      )}
      {missing && !hasKeys && (
        <p className="error" role="alert">
          Enregistre d'abord la clé et le secret ci-dessous.
        </p>
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
          <label>
            Clé API
            <input ref={keyField} name="lastfm-key" value={key} onChange={(e) => setKey(e.target.value)} {...PASTED} />
          </label>
          <label>
            Secret partagé
            <input type="password" name="lastfm-secret" value={secret} onChange={(e) => setSecret(e.target.value)} {...PASTED} />
          </label>
          <button className="scrobble-btn">Enregistrer la clé</button>
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

export default function Settings({ count, total, live, onLive, controls, onControls, skipSongs, onSkipSongs, lastStatus, onClose }) {
  const settings = useScrobbleSettings()
  return (
    <div className="wheel-backdrop" onClick={onClose}>
      <div className="scrobble-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Réglages">
        <div className="scrobble-head">
          <h2>Réglages</h2>
          <button className="btn-link" onClick={onClose}>
            Fermer
          </button>
        </div>
        <section>
          <label className="switch-row">
            <span>
              <b>Écoute en direct</b>
              <span className="scrobble-help">
                Chaque poste suit l'horloge, comme une vraie radio&nbsp;: il continue pendant que tu écoutes ailleurs, et tout le monde entend le même
                moment. Sinon, l'app reprend dans ce que tu n'as pas encore entendu.
              </span>
            </span>
            <input type="checkbox" role="switch" className="switch" checked={live} onChange={(e) => onLive(e.target.checked)} />
          </label>
        </section>
        <section>
          <label className="switch-row">
            <span>
              <b>Commandes du téléphone</b>
              <span className="scrobble-help">
                Le poste, la chanson et le logo s'affichent sur l'écran verrouillé, dans la notification, dans l'auto et dans les lanceurs comme AutoZen,
                et leurs touches commandent la radio. Pour ça, l'app joue une piste de silence à côté de YouTube&nbsp;: désactive-le si le son coupe.
              </span>
            </span>
            <input type="checkbox" role="switch" className="switch" checked={controls} onChange={(e) => onControls(e.target.checked)} />
          </label>
          <label className="switch-row">
            <span>
              <b>Précédent et suivant changent de chanson</b>
              <span className="scrobble-help">
                Sur les postes dont on a la liste des chansons ({count} sur {total}). Ailleurs, et quand c'est désactivé, ces touches changent de
                poste.
              </span>
            </span>
            <input type="checkbox" role="switch" className="switch" checked={skipSongs} onChange={(e) => onSkipSongs(e.target.checked)} />
          </label>
        </section>
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
        {lastStatus?.state === 'error' && (
          <p className="error" role="alert">
            {lastStatus.error}
          </p>
        )}
        {lastStatus?.state === 'done' && (
          <p className="scrobble-help">
            Dernière envoyée&nbsp;: {lastStatus.song.artist} - {lastStatus.song.track}
          </p>
        )}
      </div>
    </div>
  )
}
