import { useState, useEffect, useRef } from 'react'
import { Plus, Image, Film, Layers, BookOpen, ChevronLeft, ChevronRight, X, Check, Heart, MessageCircle, Send, Bookmark, MoreHorizontal, MessageSquare, CornerDownLeft, Download, Edit2, Upload, FileText, Trash2 } from 'lucide-react'
import Header from '../components/layout/Header'
import { useClients } from '../context/ClientContext'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationContext'
import { supabase } from '../lib/supabase'

const TYPES = {
  Feed: { icon: Image, color: 'text-orange-400 bg-orange-500/20' },
  Story: { icon: BookOpen, color: 'text-pink-400 bg-pink-600/20' },
  Reels: { icon: Film, color: 'text-amber-400 bg-amber-600/20' },
  Carrossel: { icon: Layers, color: 'text-cyan-400 bg-cyan-600/20' },
}

const STATUS = {
  Rascunho: 'bg-[#2a2a2a]/30 text-[#888888]',
  'Em aprovação': 'bg-amber-600/20 text-amber-400',
  Aprovado: 'bg-orange-500/20 text-orange-400',
  Publicado: 'bg-emerald-600/20 text-emerald-400',
}

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const EMPTY_FORM = { title: '', type: 'Feed', status: 'Rascunho', caption: '', objective: '', hook: '', script: '', reference: '', cta: '', markdown_content: '' }

function getDaysInMonth(year, month) { return new Date(year, month + 1, 0).getDate() }
function getFirstDay(year, month) { return new Date(year, month, 1).getDay() }
function formatCommentTime(iso) {
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' às')
}

// ── Renderizador de Markdown ─────────────────────────────────────────────────

function renderInline(text) {
  return text.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4)
      return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2 && !part.startsWith('**'))
      return <em key={i} className="italic text-[#aaa]">{part.slice(1, -1)}</em>
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2)
      return <code key={i} className="bg-[#1a1a1a] px-1.5 py-0.5 rounded text-orange-400 text-sm font-mono">{part.slice(1, -1)}</code>
    return part || null
  })
}

function MarkdownRenderer({ content }) {
  const lines = content.split('\n')
  const result = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim()
      const codeLines = []
      let j = i + 1
      while (j < lines.length && !lines[j].startsWith('```')) {
        codeLines.push(lines[j])
        j++
      }
      result.push(
        <pre key={i} className="bg-[#0d0d0d] border border-[#222] rounded-xl p-5 overflow-x-auto my-5 custom-scrollbar">
          <code className="text-sm text-[#c8c8c8] font-mono leading-7 whitespace-pre">{codeLines.join('\n')}</code>
        </pre>
      )
      i = j + 1
      continue
    }

    // Table
    if (line.trim().startsWith('|') && line.includes('|')) {
      const rows = []
      let j = i
      while (j < lines.length && lines[j].trim().startsWith('|')) {
        const isSeparator = !lines[j].replace(/[\|:\-\s]/g, '')
        if (!isSeparator) {
          rows.push(lines[j].trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim()))
        }
        j++
      }
      if (rows.length > 0) {
        result.push(
          <table key={i} className="w-full text-sm my-5 border-collapse">
            <thead>
              <tr>{rows[0].map((c, k) => <th key={k} className="text-left text-[#666] text-xs uppercase tracking-wider py-2 pr-6 border-b border-[#222]">{c}</th>)}</tr>
            </thead>
            <tbody>
              {rows.slice(1).map((row, r) => (
                <tr key={r} className="border-b border-[#1a1a1a]">
                  {row.map((c, k) => <td key={k} className="text-[#c8c8c8] py-2.5 pr-6">{renderInline(c)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        )
      }
      i = j
      continue
    }

    // Bullet list — collect consecutive items
    if (line.match(/^[-*] /)) {
      const items = []
      let j = i
      while (j < lines.length && lines[j].match(/^[-*] /)) {
        items.push(lines[j].slice(2))
        j++
      }
      result.push(
        <ul key={i} className="my-3 space-y-1.5 pl-4">
          {items.map((item, k) => (
            <li key={k} className="text-[#c8c8c8] text-base leading-relaxed flex gap-2 before:content-['–'] before:text-[#444] before:flex-shrink-0">
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      )
      i = j
      continue
    }

    // Numbered list
    if (line.match(/^\d+\. /)) {
      const items = []
      let j = i
      while (j < lines.length && lines[j].match(/^\d+\. /)) {
        items.push(lines[j].replace(/^\d+\. /, ''))
        j++
      }
      result.push(
        <ol key={i} className="my-3 space-y-1.5 pl-5 list-decimal">
          {items.map((item, k) => <li key={k} className="text-[#c8c8c8] text-base leading-relaxed">{renderInline(item)}</li>)}
        </ol>
      )
      i = j
      continue
    }

    // Headings
    if (line.startsWith('### '))
      result.push(<h3 key={i} className="text-base font-semibold text-white mt-7 mb-2">{renderInline(line.slice(4))}</h3>)
    else if (line.startsWith('## '))
      result.push(<h2 key={i} className="text-xl font-semibold text-white mt-8 mb-3 pb-2 border-b border-[#1e1e1e]">{renderInline(line.slice(3))}</h2>)
    else if (line.startsWith('# '))
      result.push(<h1 key={i} className="text-3xl font-bold text-white mt-6 mb-4">{renderInline(line.slice(2))}</h1>)
    // Blockquote
    else if (line.startsWith('> '))
      result.push(
        <blockquote key={i} className="border-l-2 border-orange-500/50 pl-5 my-4 text-[#aaa] italic text-base leading-relaxed">
          {renderInline(line.slice(2))}
        </blockquote>
      )
    // Horizontal rule
    else if (line === '---' || line === '***' || line === '___')
      result.push(<hr key={i} className="border-[#222] my-7" />)
    // Empty line
    else if (line.trim() === '')
      result.push(<div key={i} className="h-2" />)
    // Paragraph
    else
      result.push(<p key={i} className="text-base text-[#c8c8c8] leading-8 my-1">{renderInline(line)}</p>)

    i++
  }

  return <div>{result}</div>
}

// ── CommentsPanel ─────────────────────────────────────────────────────────────

function CommentsPanel({ comments, commentsLoading, newComment, setNewComment, submitComment, savingComment, commentsEndRef, deleteComment, currentRole, fullHeight = false }) {
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 mb-4 flex-shrink-0">
        <MessageSquare size={14} className="text-orange-400" />
        <span className="text-sm font-semibold text-white">Comentários</span>
        {comments.length > 0 && (
          <span className="text-xs text-[#555] bg-[#2a2a2a] px-1.5 py-0.5 rounded-full">{comments.length}</span>
        )}
      </div>

      <div
        className="flex-1 overflow-y-auto space-y-4 min-h-0 pr-1 custom-scrollbar"
        style={fullHeight ? undefined : { maxHeight: '320px' }}
      >
        {commentsLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-4 h-4 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare size={28} className="text-[#2a2a2a] mx-auto mb-3" />
            <p className="text-sm text-[#555]">Nenhum comentário ainda.</p>
            <p className="text-xs text-[#3a3a3a] mt-1">Seja o primeiro a comentar.</p>
          </div>
        ) : (
          comments.map(c => {
            const isOwn = c.author_role === currentRole
            return (
              <div key={c.id} className={`flex gap-2.5 group ${c.author_role === 'admin' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${
                  c.author_role === 'admin' ? 'bg-orange-500 text-white' : 'bg-indigo-600 text-white'
                }`}>
                  {c.author_name?.charAt(0).toUpperCase()}
                </div>
                <div className={`max-w-[82%] flex flex-col ${c.author_role === 'admin' ? 'items-end' : 'items-start'}`}>
                  <div className={`flex items-center gap-1.5 mb-1 ${c.author_role === 'admin' ? 'flex-row-reverse' : ''}`}>
                    <span className="text-xs font-medium text-white">{c.author_name}</span>
                    <span className="text-[10px] text-[#444]">{formatCommentTime(c.created_at)}</span>
                    {isOwn && deleteComment && (
                      <button
                        onClick={() => deleteComment(c.id)}
                        className="opacity-0 group-hover:opacity-100 text-[#333] hover:text-red-400 transition-all"
                        title="Apagar comentário"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                  <div className={`px-3 py-2.5 rounded-xl text-sm text-[#ddd] leading-relaxed ${
                    c.author_role === 'admin'
                      ? 'bg-orange-500/15 border border-orange-500/20 rounded-tr-sm'
                      : 'bg-[#1e1e1e] border border-[#2a2a2a] rounded-tl-sm'
                  }`}>
                    {c.content}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={commentsEndRef} />
      </div>

      <div className="mt-4 pt-4 border-t border-[#2a2a2a] flex-shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment() } }}
            placeholder="Escreva um comentário… (Enter para enviar)"
            rows={3}
            className="flex-1 bg-[#151515] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[#3a3a3a] focus:outline-none focus:border-orange-500/50 resize-none transition-colors leading-relaxed"
          />
          <button
            onClick={submitComment}
            disabled={!newComment.trim() || savingComment}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all flex-shrink-0 self-end"
          >
            {savingComment
              ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <CornerDownLeft size={15} />
            }
          </button>
        </div>
        <p className="text-[10px] text-[#3a3a3a] mt-1.5">Shift+Enter para nova linha</p>
      </div>
    </div>
  )
}

// ── ContentSection (structured fields) ───────────────────────────────────────

function ContentSection({ label, children, large = false, accent = false }) {
  return (
    <section className="mb-10">
      <p className="text-[11px] font-semibold text-[#444] uppercase tracking-widest mb-3">{label}</p>
      <div className={`leading-8 whitespace-pre-wrap ${
        large ? 'text-2xl font-semibold text-white leading-snug' :
        accent ? 'text-base text-orange-400 font-medium' :
        'text-base text-[#c8c8c8]'
      }`}>
        {children}
      </div>
    </section>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ContentCalendar() {
  const { activeClient } = useClients()
  const { isAdmin, isClient } = useAuth()
  const { sendNotification } = useNotifications()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [posts, setPosts] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [viewMode, setViewMode] = useState('view')
  const [selectedDay, setSelectedDay] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [filterStatus, setFilterStatus] = useState('Todos')
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [draggedPostId, setDraggedPostId] = useState(null)
  const [dragOverDay, setDragOverDay] = useState(null)
  const [postToDelete, setPostToDelete] = useState(null)

  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [savingComment, setSavingComment] = useState(false)
  const [commentsLoading, setCommentsLoading] = useState(false)
  const commentsEndRef = useRef(null)
  const mdInputRef = useRef(null)
  const mdFormInputRef = useRef(null)

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDay(year, month)

  useEffect(() => {
    if (activeClient && supabase) loadPosts()
    else setPosts([])
  }, [activeClient, year, month])

  async function loadPosts() {
    setLoading(true)
    const { data, error } = await supabase
      .from('calendar_posts').select('*')
      .eq('client_id', activeClient.id).eq('year', year).eq('month', month)
    if (!error && data) setPosts(data)
    setLoading(false)
  }

  async function loadComments(postId) {
    setCommentsLoading(true)
    const { data, error } = await supabase
      .from('post_comments').select('*').eq('post_id', postId)
      .order('created_at', { ascending: true })
    if (!error && data) setComments(data)
    setCommentsLoading(false)
  }

  async function deleteComment(commentId) {
    if (!supabase) return
    const { error } = await supabase.from('post_comments').delete().eq('id', commentId)
    if (!error) setComments(prev => prev.filter(c => c.id !== commentId))
  }

  async function submitComment() {
    if (!newComment.trim() || !editingId || savingComment) return
    setSavingComment(true)
    const payload = {
      post_id: editingId,
      author_role: isAdmin ? 'admin' : 'client',
      author_name: isAdmin ? 'Admin' : (activeClient?.name || 'Cliente'),
      content: newComment.trim(),
    }
    const { data, error } = await supabase.from('post_comments').insert([payload]).select().single()
    if (!error && data) {
      setComments(prev => [...prev, data])
      setNewComment('')
      setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      
      // Envia notificação para a outra parte
      const targetRole = isAdmin ? 'client' : 'admin'
      const title = `Novo comentário de ${payload.author_name}`
      const message = `No post "${form.title}": ${payload.content.substring(0, 50)}...`
      sendNotification(activeClient.id, targetRole, title, message)
    }
    setSavingComment(false)
  }

  // Upload .md no formulário (sem salvar ainda)
  function handleMdUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    file.text().then(content => setForm(f => ({ ...f, markdown_content: content })))
    e.target.value = ''
  }

  // Upload .md direto da visualização (salva imediatamente)
  async function handleMdUploadAndSave(e) {
    const file = e.target.files[0]
    if (!file || !editingId) return
    const content = await file.text()
    setForm(f => ({ ...f, markdown_content: content }))
    await supabase.from('calendar_posts').update({ markdown_content: content }).eq('id', editingId)
    setPosts(prev => prev.map(p => p.id === editingId ? { ...p, markdown_content: content } : p))
    e.target.value = ''
  }

  // Remove .md direto da visualização
  async function removeMdContent() {
    setForm(f => ({ ...f, markdown_content: '' }))
    if (editingId) {
      await supabase.from('calendar_posts').update({ markdown_content: '' }).eq('id', editingId)
      setPosts(prev => prev.map(p => p.id === editingId ? { ...p, markdown_content: '' } : p))
    }
  }

  function exportMarkdown() {
    const lines = [
      `# ${form.title}`, ``,
      `**Dia:** ${selectedDay} de ${MONTHS[month]} de ${year} | **Formato:** ${form.type} | **Status:** ${form.status}`,
      ``, `---`, ``,
    ]
    if (form.objective) lines.push(`## Objetivo\n\n${form.objective}\n`)
    if (form.hook) lines.push(`## Gancho\n\n${form.hook}\n`)
    if (form.script) lines.push(`## Roteiro\n\n${form.script}\n`)
    if (form.caption) lines.push(`## Legenda\n\n${form.caption}\n`)
    if (form.cta) lines.push(`## CTA\n\n${form.cta}\n`)
    if (form.reference) lines.push(`## Referência\n\n${form.reference}\n`)
    if (form.markdown_content) lines.push(`---\n\n${form.markdown_content}`)

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(form.title || 'conteudo').replace(/[^a-zA-Z0-9À-ÿ\s-]/g, '').trim().replace(/\s+/g, '-')}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1)
  }

  function openAdd(day) {
    if (!isAdmin) return
    setSelectedDay(day); setEditingId(null); setViewMode('edit')
    setComments([]); setNewComment(''); setForm(EMPTY_FORM)
    setShowModal(true)
  }

  function openEdit(post) {
    setSelectedDay(post.day); setEditingId(post.id); setViewMode('view')
    setComments([]); setNewComment('')
    setForm({
      title: post.title || '', type: post.type || 'Feed', status: post.status || 'Rascunho',
      caption: post.caption || '', objective: post.objective || '', hook: post.hook || '',
      script: post.script || '', reference: post.reference || '', cta: post.cta || '',
      markdown_content: post.markdown_content || '',
    })
    if (supabase) loadComments(post.id)
    setShowModal(true)
  }

  async function savePost() {
    if (!form.title.trim() || !activeClient) return

    // Separa markdown_content dos demais campos (pode não existir na tabela ainda)
    const { markdown_content, ...coreFields } = form

    if (editingId) {
      // Tenta update com todos os campos; se falhar por markdown_content, tenta sem
      let { error } = await supabase.from('calendar_posts').update(form).eq('id', editingId)
      if (error?.message?.includes('markdown_content')) {
        const { error: e2 } = await supabase.from('calendar_posts').update(coreFields).eq('id', editingId)
        error = e2
      }
      if (!error) { 
        setPosts(prev => prev.map(p => p.id === editingId ? { ...p, ...form } : p)); setViewMode('view') 
        
        // Se mudou de Rascunho para algo diferente, notifica o cliente
        const oldPost = posts.find(p => p.id === editingId)
        if (oldPost?.status === 'Rascunho' && form.status !== 'Rascunho') {
          sendNotification(activeClient.id, 'client', 'Conteúdo Pronto para Análise', `O post "${form.title}" foi movido para: ${form.status}.`)
        }
      }
      else { console.error(error); alert(`Erro ao atualizar: ${error.message}`) }
    } else {
      const newPost = { client_id: activeClient.id, year, month, day: selectedDay, ...form }
      let { data, error } = await supabase.from('calendar_posts').insert([newPost]).select().single()

      if (error?.message?.includes('markdown_content')) {
        const postSemMd = { client_id: activeClient.id, year, month, day: selectedDay, ...coreFields }
        const result = await supabase.from('calendar_posts').insert([postSemMd]).select().single()
        data = result.data
        error = result.error
      }

      if (!error && data) { 
        setPosts(prev => [...prev, data]); setShowModal(false) 
        
        // Se o post foi criado direto como aprovado/análise, notifica o cliente
        if (form.status !== 'Rascunho') {
          sendNotification(activeClient.id, 'client', 'Novo Conteúdo Disponível', `O post "${form.title}" foi adicionado e está em ${form.status}.`)
        }
      }
      else { console.error(error); alert(`Erro ao salvar: ${error?.message || 'Erro desconhecido'}`) }
    }
  }

  async function cycleStatus(id, currentStatus) {
    const order = Object.keys(STATUS)
    const next = order[(order.indexOf(currentStatus) + 1) % order.length]
    setPosts(prev => prev.map(p => p.id === id ? { ...p, status: next } : p))
    await supabase.from('calendar_posts').update({ status: next }).eq('id', id)
    
    // Notifica o cliente que o admin alterou o status, APENAS se não for Rascunho
    if (isAdmin && activeClient && next !== 'Rascunho') {
      const post = posts.find(p => p.id === id)
      sendNotification(activeClient.id, 'client', 'Status Atualizado', `O post "${post?.title}" foi movido para: ${next}`)
    }
  }

  function removePost(id) {
    setPostToDelete(id)
  }

  async function confirmDelete() {
    if (!postToDelete) return
    setPosts(prev => prev.filter(p => p.id !== postToDelete))
    await supabase.from('calendar_posts').delete().eq('id', postToDelete)
    setPostToDelete(null)
  }

  async function movePost(postId, newDay) {
    if (!postId || !newDay) return
    const post = posts.find(p => p.id === postId)
    if (!post || post.day === newDay) return
    // Atualiza localmente para feedback imediato
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, day: newDay } : p))
    const { error } = await supabase.from('calendar_posts').update({ day: newDay }).eq('id', postId)
    if (error) {
      // Reverte se falhar
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, day: post.day } : p))
      console.error('Erro ao mover post:', error)
    }
  }

  const visiblePosts = isClient ? posts.filter(p => p.status !== 'Rascunho') : posts
  const filtered = filterStatus === 'Todos' ? visiblePosts : visiblePosts.filter(p => p.status === filterStatus)
  const commentsPanelProps = { comments, commentsLoading, newComment, setNewComment, submitComment, savingComment, commentsEndRef, deleteComment, currentRole: isAdmin ? 'admin' : 'client' }
  const isFullScreen = showModal && editingId && viewMode === 'view'
  const isFormModal = showModal && (!editingId || viewMode === 'edit')
  const TypeIcon = TYPES[form.type]?.icon || Image
  const hasStructuredContent = form.objective || form.hook || form.script || form.caption || form.cta || form.reference

  if (!activeClient) {
    return (
      <div>
        <Header title="Calendário de Conteúdo" />
        <div className="p-6 flex flex-col items-center justify-center text-center mt-20 border-2 border-dashed border-[#2a2a2a] rounded-2xl py-20 bg-[#111111]/50">
          <h2 className="text-xl font-medium text-white mb-2">Selecione um cliente</h2>
          <p className="text-[#888888] max-w-md">Para acessar o calendário, escolha ou crie um cliente na aba Clientes.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Header title="Calendário de Conteúdo" />
      {isClient && (
        <div className="mx-6 mt-4 flex items-center gap-2.5 px-4 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl">
          <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
          <p className="text-xs text-[#888888]">Você está no <span className="text-amber-400 font-medium">modo visualização</span>. Para aprovar conteúdos ou deixar comentários, clique em qualquer post.</p>
        </div>
      )}
      <div className="p-6 space-y-5">

        {/* Controles */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button onClick={prevMonth} className="w-8 h-8 rounded-lg bg-[#1a1a1a] text-[#888] hover:text-white flex items-center justify-center"><ChevronLeft size={16} /></button>
            <h2 className="text-base font-semibold text-white">{MONTHS[month]} {year}</h2>
            <button onClick={nextMonth} className="w-8 h-8 rounded-lg bg-[#1a1a1a] text-[#888] hover:text-white flex items-center justify-center"><ChevronRight size={16} /></button>
          </div>
          <div className="flex gap-2 flex-wrap">
            {['Todos', ...Object.keys(STATUS)].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-3 py-1 text-xs rounded-lg transition-all ${filterStatus === s ? 'bg-orange-500 text-white' : 'bg-[#1a1a1a] text-[#888] hover:bg-[#222]'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Calendário */}
        <div className="bg-[#1a1a1a]/50 border border-[#2a2a2a]/50 rounded-xl overflow-hidden">
          <div className="grid grid-cols-7 border-b border-[#2a2a2a]">
            {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d => (
              <div key={d} className="py-2 text-center text-[10px] md:text-xs font-medium text-[#555]">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`e-${i}`} className="min-h-[60px] md:min-h-[90px] border-r border-b border-[#2a2a2a]/30 bg-black/20" />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const dayPosts = filtered.filter(p => p.day === day)
              const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
              const isDragOver = dragOverDay === day
              return (
                <div key={day}
                  className={`min-h-[60px] md:min-h-[90px] border-r border-b p-1 md:p-1.5 group transition-all relative
                    ${isToday ? 'bg-orange-950/30' : ''}
                    ${isDragOver
                      ? 'bg-orange-500/10 border-orange-500/40 ring-1 ring-inset ring-orange-500/30'
                      : 'border-[#2a2a2a]/30 ' + (isAdmin ? 'hover:bg-[#222]/20' : '')}
                    ${isAdmin ? 'cursor-pointer' : ''}`}
                  onClick={() => isAdmin && !draggedPostId && openAdd(day)}
                  onDragOver={e => { if (!isAdmin) return; e.preventDefault(); setDragOverDay(day) }}
                  onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverDay(null) }}
                  onDrop={e => {
                    e.preventDefault()
                    setDragOverDay(null)
                    if (draggedPostId) movePost(draggedPostId, day)
                    setDraggedPostId(null)
                  }}
                >
                  <div className={`text-[10px] md:text-xs font-medium mb-1 w-5 h-5 md:w-6 md:h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-orange-500 text-white' : 'text-[#555]'}`}>{day}</div>
                  
                  {/* Desktop View: Full badges */}
                  <div className="hidden md:block space-y-0.5">
                    {dayPosts.map(p => {
                      const { icon: Icon, color } = TYPES[p.type] || TYPES.Feed
                      const isDragging = draggedPostId === p.id
                      return (
                        <div key={p.id}
                          draggable={isAdmin}
                          className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] ${color} cursor-pointer hover:brightness-110 transition-all select-none
                            ${isDragging ? 'opacity-40 scale-95' : ''}
                            ${isAdmin ? 'cursor-grab active:cursor-grabbing' : ''}`}
                          onClick={e => { e.stopPropagation(); if (!isDragging) openEdit(p) }}
                          onDragStart={e => { e.stopPropagation(); setDraggedPostId(p.id) }}
                          onDragEnd={() => { setDraggedPostId(null); setDragOverDay(null) }}
                        >
                          <Icon size={10} className="flex-shrink-0" />
                          <span className="truncate">{p.title}</span>
                          {p.markdown_content && <FileText size={8} className="flex-shrink-0 opacity-60" />}
                        </div>
                      )
                    })}
                  </div>

                  {/* Mobile View: Small indicators (Dots) */}
                  <div className="flex md:hidden flex-wrap gap-1 mt-auto">
                    {dayPosts.map(p => {
                      const { color } = TYPES[p.type] || TYPES.Feed
                      // Extract background color for the dot
                      const dotColor = color.split(' ')[1] || 'bg-orange-500'
                      return (
                        <div key={p.id} className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                      )
                    })}
                  </div>

                  {isAdmin && !draggedPostId && (
                    <div className="hidden group-hover:flex items-center justify-center mt-1">
                      <span className="text-[10px] text-orange-400 flex items-center gap-0.5"><Plus size={10} /> add</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Lista */}
        <div className="bg-[#1a1a1a]/50 border border-[#2a2a2a]/50 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Posts do Mês ({filtered.length})</h2>
          <div className="space-y-2">
            {filtered.sort((a, b) => a.day - b.day).map(p => {
              const { icon: Icon, color } = TYPES[p.type] || TYPES.Feed
              return (
                <div
                  key={p.id}
                  onClick={() => openEdit(p)}
                  className="flex items-center gap-3 py-2.5 px-3 bg-[#222]/30 rounded-lg hover:bg-[#222]/60 transition-all cursor-pointer group"
                >
                  <span className="text-xs text-[#555] w-6 text-center flex-shrink-0">{p.day}</span>
                  <div className={`p-1.5 rounded-lg flex-shrink-0 ${color}`}><Icon size={13} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm text-white truncate group-hover:text-orange-100 transition-colors">{p.title}</p>
                      {p.markdown_content && <FileText size={11} className="text-[#555] flex-shrink-0" />}
                    </div>
                    {p.caption && <p className="text-xs text-[#555] mt-0.5 truncate">{p.caption}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    {isAdmin && (
                      <>
                        <button onClick={() => cycleStatus(p.id, p.status)} className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS[p.status]}`}>{p.status}</button>
                        <button onClick={() => removePost(p.id)} className="text-[#333] hover:text-red-400 transition-colors"><X size={14} /></button>
                      </>
                    )}
                    {isClient && <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS[p.status]}`}>{p.status}</span>}
                  </div>
                </div>
              )
            })}
            {filtered.length === 0 && <p className="text-sm text-[#555] text-center py-6">Nenhum post {filterStatus !== 'Todos' ? `com status "${filterStatus}"` : 'neste mês'}.</p>}
          </div>
        </div>
      </div>

      {/* ── VISUALIZAÇÃO FULL-SCREEN ── */}
      {isFullScreen && (
        <div className="fixed inset-0 bg-[#080808] z-50 flex flex-col">
          {/* Inputs ocultos para upload */}
          <input ref={mdInputRef} type="file" accept=".md,.txt" className="hidden" onChange={handleMdUploadAndSave} />

          {/* Top bar */}
          <div className="flex items-center justify-between px-4 md:px-6 h-14 border-b border-[#1e1e1e] bg-[#0d0d0d] flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => setShowModal(false)} className="text-[#555] hover:text-white transition-colors flex-shrink-0"><X size={18} /></button>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-white truncate leading-tight">{form.title}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`inline-flex items-center gap-1 text-[10px] md:text-[11px] px-2 py-0.5 rounded-full font-medium ${TYPES[form.type]?.color || ''}`}>
                    <TypeIcon size={10} /> <span className="hidden xs:inline">{form.type}</span>
                  </span>
                  <span className={`text-[10px] md:text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS[form.status] || ''}`}>{form.status}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0 ml-2">
              <button onClick={exportMarkdown}
                title="Exportar .md"
                className="flex items-center justify-center md:gap-1.5 w-8 h-8 md:w-auto md:px-3 md:py-1.5 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] hover:text-white text-xs font-medium transition-all">
                <Download size={13} /> <span className="hidden md:inline">Exportar</span>
              </button>
              {isAdmin && (
                <>
                  <button onClick={() => setViewMode('edit')}
                    className="flex items-center justify-center md:gap-1.5 w-8 h-8 md:w-auto md:px-3 md:py-1.5 rounded-lg bg-orange-500/20 border border-orange-500/30 text-orange-400 hover:bg-orange-500/30 text-xs font-medium transition-all">
                    <Edit2 size={13} /> <span className="hidden md:inline">Editar</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">

            {/* Conteúdo */}
            <div className="flex-1 overflow-y-auto custom-scrollbar border-b lg:border-b-0 lg:border-r border-[#1e1e1e]">
              <div className="max-w-2xl mx-auto px-5 md:px-10 py-8 md:py-10">
                <p className="text-[10px] md:text-[11px] text-[#444] mb-6 uppercase tracking-widest">
                  Publicação para dia {selectedDay} de {MONTHS[month]} de {year}
                </p>

                {/* Arquivo .md (se existir) */}
                {form.markdown_content && (
                  <div className="mb-8">
                    {isAdmin && (
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2 text-xs text-[#555]">
                          <FileText size={12} className="text-orange-400" />
                          <span>Arquivo .md anexado</span>
                        </div>
                        <button onClick={removeMdContent} className="flex items-center gap-1 text-xs text-[#555] hover:text-red-400 transition-colors">
                          <Trash2 size={11} /> Remover
                        </button>
                      </div>
                    )}
                    <div className="prose-mobile">
                      <MarkdownRenderer content={form.markdown_content} />
                    </div>
                  </div>
                )}

                {/* Campos estruturados */}
                {hasStructuredContent && !form.markdown_content && (
                  <>
                    {form.objective && <ContentSection label="Objetivo">{form.objective}</ContentSection>}
                    {form.hook && <ContentSection label="Gancho" large>{form.hook}</ContentSection>}
                    {form.script && <ContentSection label="Roteiro">{form.script}</ContentSection>}
                    {form.caption && <ContentSection label="Legenda & Hashtags">{form.caption}</ContentSection>}
                    {form.cta && <ContentSection label="Call to Action" accent>{form.cta}</ContentSection>}
                    {form.reference && (
                      <section className="mb-10">
                        <p className="text-[11px] font-semibold text-[#444] uppercase tracking-widest mb-3">Referência</p>
                        <a href={form.reference} target="_blank" rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 underline underline-offset-4 break-all text-sm md:text-base transition-colors">
                          {form.reference}
                        </a>
                      </section>
                    )}
                  </>
                )}

                {/* Campos estruturados como resumo quando .md existe */}
                {hasStructuredContent && form.markdown_content && (
                  <details className="mt-8 group">
                    <summary className="text-xs text-[#444] cursor-pointer hover:text-[#888] transition-colors select-none flex items-center gap-1.5">
                      <span className="group-open:rotate-90 transition-transform inline-block">›</span>
                      Ver campos estruturados
                    </summary>
                    <div className="mt-6 pl-4 border-l border-[#1e1e1e] space-y-6">
                      {form.objective && <ContentSection label="Objetivo">{form.objective}</ContentSection>}
                      {form.hook && <ContentSection label="Gancho">{form.hook}</ContentSection>}
                      {form.script && <ContentSection label="Roteiro">{form.script}</ContentSection>}
                      {form.caption && <ContentSection label="Legenda">{form.caption}</ContentSection>}
                      {form.cta && <ContentSection label="CTA" accent>{form.cta}</ContentSection>}
                    </div>
                  </details>
                )}

                {!hasStructuredContent && !form.markdown_content && (
                  <div className="text-center py-20">
                    <FileText size={32} className="text-[#2a2a2a] mx-auto mb-4" />
                    <p className="text-[#555] mb-2">Nenhum conteúdo ainda.</p>
                    {isAdmin && (
                      <p className="text-xs text-[#3a3a3a]">Edite o post ou envie um arquivo .md.</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Painel de comentários */}
            <div className="h-80 lg:h-auto lg:w-96 flex-shrink-0 flex flex-col bg-[#0a0a0a] overflow-hidden">
              <div className="flex-1 flex flex-col overflow-hidden p-4 md:p-5">
                <CommentsPanel {...commentsPanelProps} fullHeight />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── FORMULÁRIO (criar / editar) ── */}
      {isFormModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <input ref={mdFormInputRef} type="file" accept=".md,.txt" className="hidden" onChange={handleMdUpload} />

          <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-6 w-full max-w-5xl max-h-[90vh] overflow-y-auto custom-scrollbar">

            <div className="flex items-center justify-between mb-5 sticky top-0 bg-[#111111] pb-3 z-10 border-b border-[#2a2a2a]">
              <h3 className="text-base font-semibold text-white">
                {editingId ? 'Editar Conteúdo' : 'Novo Conteúdo'} — Dia {selectedDay}
              </h3>
              <div className="flex items-center gap-2">
                {editingId && (
                  <button onClick={() => setViewMode('view')} className="text-xs text-[#888] hover:text-white px-3 py-1.5 rounded-lg bg-[#1a1a1a] hover:bg-[#2a2a2a] transition-all">
                    ← Ver conteúdo
                  </button>
                )}
                <button onClick={() => setShowModal(false)} className="text-[#555] hover:text-white"><X size={18} /></button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Formulário */}
              <div className="lg:col-span-8 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  <div className="md:col-span-6">
                    <label className="text-xs text-[#888] block mb-1">Título do Conteúdo *</label>
                    <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-400"
                      placeholder="Ex: 5 dicas para..." />
                  </div>
                  <div className="md:col-span-3">
                    <label className="text-xs text-[#888] block mb-1">Formato</label>
                    <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-400">
                      {Object.keys(TYPES).map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <label className="text-xs text-[#888] block mb-1">Status</label>
                    <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-400">
                      {Object.keys(STATUS).map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                {/* Upload .md */}
                <div>
                  <label className="text-xs text-[#888] block mb-2">Arquivo de conteúdo (.md)</label>
                  {form.markdown_content ? (
                    <div className="flex items-center gap-3 px-4 py-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                      <FileText size={16} className="text-orange-400 flex-shrink-0" />
                      <span className="text-sm text-orange-400 flex-1">Arquivo .md anexado</span>
                      <button onClick={() => mdFormInputRef.current?.click()} className="text-xs text-[#888] hover:text-white transition-colors">Substituir</button>
                      <button onClick={() => setForm(f => ({ ...f, markdown_content: '' }))} className="text-[#555] hover:text-red-400 transition-colors"><X size={14} /></button>
                    </div>
                  ) : (
                    <button onClick={() => mdFormInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#1a1a1a] border border-dashed border-[#2a2a2a] rounded-lg text-sm text-[#555] hover:text-[#888] hover:border-[#333] transition-all">
                      <Upload size={15} /> Clique para anexar um arquivo .md
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-[#888] block mb-1">Objetivo da Peça</label>
                      <input value={form.objective} onChange={e => setForm(f => ({ ...f, objective: e.target.value }))}
                        className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-400"
                        placeholder="Ex: Conversão, Engajamento..." />
                    </div>
                    <div>
                      <label className="text-xs text-[#888] block mb-1">Gancho (Hook)</label>
                      <textarea value={form.hook} onChange={e => setForm(f => ({ ...f, hook: e.target.value }))} rows={2}
                        className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-400 resize-none"
                        placeholder="Frase de impacto..." />
                    </div>
                    <div>
                      <label className="text-xs text-[#888] block mb-1">Roteiro / Estrutura</label>
                      <textarea value={form.script} onChange={e => setForm(f => ({ ...f, script: e.target.value }))} rows={4}
                        className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-400 resize-none"
                        placeholder="Desenvolvimento do conteúdo..." />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-[#888] block mb-1">Call to Action (CTA)</label>
                      <input value={form.cta} onChange={e => setForm(f => ({ ...f, cta: e.target.value }))}
                        className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-400"
                        placeholder="Ex: Comente EU QUERO..." />
                    </div>
                    <div>
                      <label className="text-xs text-[#888] block mb-1">Legenda Completa & Hashtags</label>
                      <textarea value={form.caption} onChange={e => setForm(f => ({ ...f, caption: e.target.value }))} rows={5}
                        className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-400 resize-none"
                        placeholder="Escreva a legenda final aqui..." />
                    </div>
                    <div>
                      <label className="text-xs text-[#888] block mb-1">Link de Referência</label>
                      <input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                        className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-400"
                        placeholder="https://..." />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#2a2a2a] flex justify-end">
                  <button onClick={savePost}
                    className="bg-orange-500 hover:bg-orange-400 text-white font-medium py-2.5 px-6 rounded-lg text-sm flex items-center gap-2 transition-all">
                    <Check size={16} /> Salvar Conteúdo
                  </button>
                </div>
              </div>

              {/* Instagram preview */}
              <div className="lg:col-span-4 flex items-start justify-center pt-2">
                <div className="w-full max-w-[300px] bg-black border border-[#2a2a2a] rounded-xl overflow-hidden shadow-2xl flex flex-col ring-1 ring-white/5">
                  <div className="flex items-center justify-between p-3 border-b border-[#1f1f1f]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 via-orange-500 to-pink-500 p-[2px]">
                        <div className="w-full h-full rounded-full flex items-center justify-center font-bold text-xs text-white" style={{ background: activeClient?.color || '#333' }}>
                          {activeClient?.name?.charAt(0)}
                        </div>
                      </div>
                      <p className="text-white text-sm font-semibold">{activeClient?.ig_handle || '@usuario'}</p>
                    </div>
                    <MoreHorizontal size={18} className="text-white" />
                  </div>
                  <div className="w-full aspect-square bg-gradient-to-br from-[#111] to-[#1a1a1a] flex flex-col items-center justify-center p-6 text-center border-b border-[#1f1f1f] relative">
                    <div className="absolute top-3 right-3 text-white/60"><TypeIcon size={16} /></div>
                    <h4 className="text-white font-bold text-lg leading-snug mb-2 line-clamp-4">{form.hook || form.title || 'Seu gancho aparece aqui'}</h4>
                    {form.script && <p className="text-[#888] text-xs line-clamp-3">{form.script}</p>}
                  </div>
                  <div className="p-3 pb-1">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3"><Heart size={20} className="text-white" /><MessageCircle size={20} className="text-white" /><Send size={20} className="text-white" /></div>
                      <Bookmark size={20} className="text-white" />
                    </div>
                  </div>
                  <div className="px-3 pb-4">
                    <p className="text-sm leading-relaxed text-[#eee]">
                      <span className="font-semibold text-white mr-1">{activeClient?.ig_handle || '@usuario'}</span>
                      {form.caption || 'Legenda aparece aqui…'}
                    </p>
                    {form.cta && <p className="text-orange-400 text-sm font-medium mt-1">👉 {form.cta}</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DE CONFIRMAÇÃO DE EXCLUSÃO ── */}
      {postToDelete && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-6 w-full max-w-sm shadow-2xl scale-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-5 mx-auto">
              <Trash2 size={24} className="text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-white text-center mb-2">Excluir Conteúdo</h3>
            <p className="text-sm text-[#888] text-center mb-6 leading-relaxed">
              Tem certeza que deseja excluir este conteúdo? Esta ação não pode ser desfeita.
            </p>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setPostToDelete(null)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] hover:text-white hover:bg-[#222] transition-colors font-medium text-sm"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmDelete}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors font-medium text-sm shadow-lg shadow-red-500/20"
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
