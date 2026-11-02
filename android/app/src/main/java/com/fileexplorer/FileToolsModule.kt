package com.fileexplorer

import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.ParcelFileDescriptor
import android.provider.Settings
import android.webkit.MimeTypeMap
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.bridge.WritableMap
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.nio.ByteBuffer
import java.nio.charset.CharacterCodingException
import java.nio.charset.Charset
import java.nio.charset.CodingErrorAction
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicInteger

/**
 * Módulo nativo con todas las operaciones de archivos. Trabaja con rutas reales
 * (java.io.File) y se apoya en MANAGE_EXTERNAL_STORAGE / permisos clásicos.
 * Nada sale del dispositivo: no hay red ni servicios externos.
 */
class FileToolsModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {

    override fun getName(): String = "FileTools"

    private val io = Executors.newFixedThreadPool(3)
    private val pdfIo = Executors.newSingleThreadExecutor()
    private val searchCounter = AtomicInteger(0)

    private companion object {
        const val MAX_TEXT_BYTES = 1024 * 1024L
        const val MAX_SEARCH_RESULTS = 300
    }

    // ------------------------------------------------------------------ utilidades

    private fun async(promise: Promise, block: () -> Any?) {
        io.execute {
            try {
                promise.resolve(block())
            } catch (e: Throwable) {
                promise.reject("E_FILE", e.message ?: e.javaClass.simpleName, e)
            }
        }
    }

    private fun entry(f: File): WritableMap {
        val m = Arguments.createMap()
        m.putString("name", f.name)
        m.putString("path", f.absolutePath)
        m.putBoolean("isDirectory", f.isDirectory)
        m.putDouble("size", if (f.isDirectory) 0.0 else f.length().toDouble())
        m.putDouble("modified", f.lastModified().toDouble())
        return m
    }

    private fun validName(raw: String): String {
        val n = raw.trim()
        if (n.isEmpty() || n == "." || n == ".." || n.contains('/') || n.contains('\u0000')) {
            throw IOException("Nombre no válido")
        }
        if (n.toByteArray().size > 255) throw IOException("El nombre es demasiado largo")
        return n
    }

    private fun isSymlink(f: File): Boolean {
        val parent = f.absoluteFile.parentFile ?: return false
        return try {
            f.canonicalFile != File(parent.canonicalFile, f.name)
        } catch (e: IOException) {
            false
        }
    }

    private fun isInside(child: File, parent: File): Boolean {
        val c = child.canonicalPath
        val p = parent.canonicalPath
        return c == p || c.startsWith("$p/")
    }

    private fun uniqueTarget(dir: File, name: String, splitExt: Boolean): File {
        val first = File(dir, name)
        if (!first.exists()) return first
        val dot = name.lastIndexOf('.')
        val base = if (splitExt && dot > 0) name.substring(0, dot) else name
        val ext = if (splitExt && dot > 0) name.substring(dot) else ""
        for (i in 1..9999) {
            val t = File(dir, "$base ($i)$ext")
            if (!t.exists()) return t
        }
        throw IOException("No se pudo generar un nombre libre")
    }

    private fun deleteTree(f: File): Boolean {
        var ok = true
        if (f.isDirectory && !isSymlink(f)) {
            val kids = f.listFiles()
            if (kids != null) {
                for (k in kids) {
                    if (!deleteTree(k)) ok = false
                }
            }
        }
        return f.delete() && ok
    }

    private fun primaryRoot(): File = Environment.getExternalStorageDirectory()

    // ------------------------------------------------------------------ almacenamiento

    @ReactMethod
    fun getRoots(promise: Promise) {
        async(promise) {
            val arr = Arguments.createArray()
            val primary = primaryRoot()
            val seen = HashSet<String>()
            seen.add(primary.absolutePath)
            val p = Arguments.createMap()
            p.putString("label", "Almacenamiento interno")
            p.putString("short", "Interno")
            p.putString("path", primary.absolutePath)
            arr.pushMap(p)

            val dirs = ctx.getExternalFilesDirs(null)
            for (d in dirs) {
                if (d == null) continue
                val abs = d.absolutePath
                val idx = abs.indexOf("/Android/data")
                if (idx <= 0) continue
                val root = abs.substring(0, idx)
                if (!seen.add(root)) continue
                val m = Arguments.createMap()
                m.putString("label", "Tarjeta SD / USB (" + File(root).name + ")")
                m.putString("short", File(root).name)
                m.putString("path", root)
                arr.pushMap(m)
            }
            arr
        }
    }

    // ------------------------------------------------------------------ permisos

    private fun hasAccess(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            Environment.isExternalStorageManager()
        } else {
            ctx.checkSelfPermission(android.Manifest.permission.READ_EXTERNAL_STORAGE) ==
                PackageManager.PERMISSION_GRANTED &&
                ctx.checkSelfPermission(android.Manifest.permission.WRITE_EXTERNAL_STORAGE) ==
                PackageManager.PERMISSION_GRANTED
        }
    }

    @ReactMethod
    fun hasAllFilesAccess(promise: Promise) {
        try {
            promise.resolve(hasAccess())
        } catch (e: Throwable) {
            promise.reject("E_PERM", e.message, e)
        }
    }

    @ReactMethod
    fun requestAllFilesAccess(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                try {
                    val i = Intent(
                        Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION,
                        Uri.parse("package:" + ctx.packageName)
                    )
                    i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    ctx.startActivity(i)
                } catch (e: Exception) {
                    val i = Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION)
                    i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    ctx.startActivity(i)
                }
            }
            promise.resolve(true)
        } catch (e: Throwable) {
            promise.reject("E_PERM", "No se pudo abrir la pantalla de permisos", e)
        }
    }

    @ReactMethod
    fun openAppSettings(promise: Promise) {
        try {
            val i = Intent(
                Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.parse("package:" + ctx.packageName)
            )
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            ctx.startActivity(i)
            promise.resolve(true)
        } catch (e: Throwable) {
            promise.reject("E_PERM", "No se pudo abrir los ajustes de la app", e)
        }
    }

    // ------------------------------------------------------------------ listado y operaciones

    @ReactMethod
    fun list(path: String, promise: Promise) {
        async(promise) {
            val dir = File(path)
            if (!dir.exists()) throw IOException("La carpeta no existe")
            if (!dir.isDirectory) throw IOException("No es una carpeta")
            val files = dir.listFiles()
                ?: throw IOException(
                    "Android no permite leer esta carpeta (está protegida o falta el permiso de acceso a todos los archivos)"
                )
            val arr = Arguments.createArray()
            for (f in files) arr.pushMap(entry(f))
            arr
        }
    }

    @ReactMethod
    fun createFolder(parent: String, name: String, promise: Promise) {
        async(promise) {
            val n = validName(name)
            val t = File(parent, n)
            if (t.exists()) throw IOException("Ya existe un elemento llamado «$n»")
            if (!t.mkdir()) throw IOException("No se pudo crear la carpeta (¿carpeta protegida o sin permisos?)")
            t.absolutePath
        }
    }

    @ReactMethod
    fun createFile(parent: String, name: String, promise: Promise) {
        async(promise) {
            val n = validName(name)
            val t = File(parent, n)
            if (t.exists()) throw IOException("Ya existe un elemento llamado «$n»")
            if (!t.createNewFile()) throw IOException("No se pudo crear el archivo (¿carpeta protegida o sin permisos?)")
            t.absolutePath
        }
    }

    @ReactMethod
    fun rename(path: String, newName: String, promise: Promise) {
        async(promise) {
            val src = File(path)
            if (!src.exists()) throw IOException("El elemento ya no existe")
            val name = validName(newName)
            val dst = File(src.absoluteFile.parentFile, name)
            if (dst.absolutePath == src.absolutePath) return@async dst.absolutePath
            if (dst.exists()) throw IOException("Ya existe un elemento llamado «$name»")
            if (!src.renameTo(dst)) throw IOException("No se pudo renombrar (¿carpeta protegida o sin permisos?)")
            dst.absolutePath
        }
    }

    @ReactMethod
    fun copy(src: String, destDir: String, promise: Promise) {
        async(promise) {
            val s = File(src)
            val d = File(destDir)
            if (!s.exists()) throw IOException("El origen ya no existe")
            if (!d.isDirectory) throw IOException("El destino no es una carpeta")
            if (s.isDirectory && isInside(d, s)) {
                throw IOException("No se puede copiar una carpeta dentro de sí misma")
            }
            val target = uniqueTarget(d, s.name, s.isFile)
            s.copyRecursively(target, false) { _, ex -> throw ex }
            target.absolutePath
        }
    }

    @ReactMethod
    fun move(src: String, destDir: String, promise: Promise) {
        async(promise) {
            val s = File(src)
            val d = File(destDir)
            if (!s.exists()) throw IOException("El origen ya no existe")
            if (!d.isDirectory) throw IOException("El destino no es una carpeta")
            if (s.isDirectory && isInside(d, s)) {
                throw IOException("No se puede mover una carpeta dentro de sí misma")
            }
            if (s.absoluteFile.parentFile?.canonicalPath == d.canonicalPath) {
                throw IOException("El elemento ya está en esta carpeta")
            }
            val target = uniqueTarget(d, s.name, s.isFile)
            if (!s.renameTo(target)) {
                // Otro volumen u otra restricción: copiar y borrar el original
                s.copyRecursively(target, false) { _, ex -> throw ex }
                if (!deleteTree(s)) {
                    throw IOException("Se copió al destino, pero no se pudo borrar el original")
                }
            }
            target.absolutePath
        }
    }

    @ReactMethod
    fun remove(path: String, promise: Promise) {
        async(promise) {
            val f = File(path)
            if (!f.exists()) throw IOException("El elemento ya no existe")
            if (f.canonicalPath == primaryRoot().canonicalPath) {
                throw IOException("No se puede eliminar la raíz del almacenamiento")
            }
            if (!deleteTree(f)) {
                throw IOException("No se pudo eliminar por completo (¿protegido o sin permisos?)")
            }
            true
        }
    }

    // ------------------------------------------------------------------ búsqueda

    @ReactMethod
    fun search(root: String, query: String, promise: Promise) {
        val id = searchCounter.incrementAndGet()
        async(promise) {
            val q = query.trim().lowercase()
            val result = Arguments.createMap()
            val items = Arguments.createArray()
            var count = 0
            var truncated = false
            var cancelled = false
            val queue = java.util.ArrayDeque<File>()
            queue.addLast(File(root))
            outer@ while (queue.isNotEmpty()) {
                if (searchCounter.get() != id) {
                    cancelled = true
                    break
                }
                val dir = queue.pollFirst() ?: break
                val children = dir.listFiles() ?: continue
                for (f in children) {
                    if (f.name.lowercase().contains(q)) {
                        items.pushMap(entry(f))
                        count++
                        if (count >= MAX_SEARCH_RESULTS) {
                            truncated = true
                            break@outer
                        }
                    }
                    if (f.isDirectory && !isSymlink(f)) queue.addLast(f)
                }
            }
            result.putBoolean("cancelled", cancelled)
            result.putBoolean("truncated", truncated)
            result.putArray("items", items)
            result
        }
    }

    @ReactMethod
    fun cancelSearch(promise: Promise) {
        searchCounter.incrementAndGet()
        promise.resolve(true)
    }

    // ------------------------------------------------------------------ texto

    @ReactMethod
    fun readText(path: String, promise: Promise) {
        async(promise) {
            val f = File(path)
            if (!f.isFile) throw IOException("El archivo no existe")
            if (f.length() > MAX_TEXT_BYTES) {
                throw IOException("El archivo es demasiado grande para editarlo (máximo 1 MB)")
            }
            val bytes = f.readBytes()
            val probe = minOf(bytes.size, 8000)
            for (i in 0 until probe) {
                if (bytes[i].toInt() == 0) throw IOException("Parece un archivo binario, no de texto")
            }
            var bom = false
            var offset = 0
            if (bytes.size >= 3 && bytes[0] == 0xEF.toByte() && bytes[1] == 0xBB.toByte() && bytes[2] == 0xBF.toByte()) {
                bom = true
                offset = 3
            }
            var encoding = "UTF-8"
            var text: String
            try {
                text = Charsets.UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT)
                    .decode(ByteBuffer.wrap(bytes, offset, bytes.size - offset))
                    .toString()
            } catch (e: CharacterCodingException) {
                encoding = "ISO-8859-1"
                text = String(bytes, Charsets.ISO_8859_1)
            }
            val crlf = text.contains("\r\n")
            if (crlf) text = text.replace("\r\n", "\n")
            val m = Arguments.createMap()
            m.putString("text", text)
            m.putString("encoding", encoding)
            m.putBoolean("bom", bom)
            m.putBoolean("crlf", crlf)
            m.putDouble("size", bytes.size.toDouble())
            m
        }
    }

    private fun encodeText(text: String, encoding: String, bom: Boolean, crlf: Boolean): Pair<ByteArray, String> {
        val body = if (crlf) text.replace("\n", "\r\n") else text
        var enc = encoding
        // Si el texto ya no cabe en Latin-1 se guarda en UTF-8 para no perder caracteres
        if (enc == "ISO-8859-1" && !Charsets.ISO_8859_1.newEncoder().canEncode(body)) enc = "UTF-8"
        val charset: Charset = if (enc == "ISO-8859-1") Charsets.ISO_8859_1 else Charsets.UTF_8
        val bytes = body.toByteArray(charset)
        val out = if (enc == "UTF-8" && bom) {
            byteArrayOf(0xEF.toByte(), 0xBB.toByte(), 0xBF.toByte()) + bytes
        } else {
            bytes
        }
        return Pair(out, enc)
    }

    private fun writeBytesSafely(f: File, data: ByteArray) {
        val parent = f.absoluteFile.parentFile ?: throw IOException("Ruta no válida")
        if (!parent.isDirectory) throw IOException("La carpeta de destino no existe")
        val tmp = File(parent, f.name + ".tmp~")
        try {
            FileOutputStream(tmp).use {
                it.write(data)
                it.fd.sync()
            }
            if (!tmp.renameTo(f)) {
                FileOutputStream(f).use { it.write(data) }
                tmp.delete()
            }
        } catch (e: IOException) {
            tmp.delete()
            throw IOException("No se pudo guardar: " + (e.message ?: "error de escritura"))
        }
    }

    private fun writeResult(f: File, enc: String, size: Int): WritableMap {
        val m = Arguments.createMap()
        m.putString("path", f.absolutePath)
        m.putString("encoding", enc)
        m.putDouble("size", size.toDouble())
        return m
    }

    @ReactMethod
    fun writeText(path: String, text: String, encoding: String, bom: Boolean, crlf: Boolean, promise: Promise) {
        async(promise) {
            val f = File(path)
            if (f.isDirectory) throw IOException("La ruta es una carpeta")
            val (bytes, enc) = encodeText(text, encoding, bom, crlf)
            writeBytesSafely(f, bytes)
            writeResult(f, enc, bytes.size)
        }
    }

    @ReactMethod
    fun saveTextAs(dir: String, name: String, text: String, encoding: String, bom: Boolean, crlf: Boolean, promise: Promise) {
        async(promise) {
            val n = validName(name)
            val f = File(dir, n)
            if (f.exists()) throw IOException("Ya existe un elemento llamado «$n»")
            val (bytes, enc) = encodeText(text, encoding, bom, crlf)
            writeBytesSafely(f, bytes)
            writeResult(f, enc, bytes.size)
        }
    }

    // ------------------------------------------------------------------ portapapeles

    @ReactMethod
    fun setClipboard(text: String, promise: Promise) {
        UiThreadUtil.runOnUiThread {
            try {
                val cm = ctx.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                cm.setPrimaryClip(ClipData.newPlainText("texto", text))
                promise.resolve(true)
            } catch (e: Throwable) {
                promise.reject("E_CLIP", "No se pudo copiar (el texto puede ser demasiado grande para el portapapeles)", e)
            }
        }
    }

    @ReactMethod
    fun getClipboard(promise: Promise) {
        UiThreadUtil.runOnUiThread {
            try {
                val cm = ctx.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                val clip = cm.primaryClip
                val text = if (clip != null && clip.itemCount > 0) {
                    clip.getItemAt(0).coerceToText(ctx)?.toString()
                } else {
                    null
                }
                promise.resolve(text)
            } catch (e: Throwable) {
                promise.reject("E_CLIP", "No se pudo leer el portapapeles", e)
            }
        }
    }

    // ------------------------------------------------------------------ abrir con otra app

    @ReactMethod
    fun openExternal(path: String, promise: Promise) {
        try {
            val f = File(path)
            if (!f.isFile) {
                promise.reject("E_OPEN", "El archivo no existe")
                return
            }
            val uri = FileProvider.getUriForFile(ctx, ctx.packageName + ".fileprovider", f)
            val mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(f.extension.lowercase()) ?: "*/*"
            val i = Intent(Intent.ACTION_VIEW)
            i.setDataAndType(uri, mime)
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
            ctx.startActivity(i)
            promise.resolve(true)
        } catch (e: ActivityNotFoundException) {
            promise.reject("E_OPEN", "No hay ninguna app instalada que pueda abrir este archivo", e)
        } catch (e: Throwable) {
            promise.reject("E_OPEN", "No se pudo abrir el archivo: " + (e.message ?: ""), e)
        }
    }

    // ------------------------------------------------------------------ preferencias

    @ReactMethod
    fun getPref(key: String, promise: Promise) {
        try {
            promise.resolve(ctx.getSharedPreferences("fileexplorer", Context.MODE_PRIVATE).getString(key, null))
        } catch (e: Throwable) {
            promise.resolve(null)
        }
    }

    @ReactMethod
    fun setPref(key: String, value: String, promise: Promise) {
        try {
            ctx.getSharedPreferences("fileexplorer", Context.MODE_PRIVATE).edit().putString(key, value).apply()
            promise.resolve(true)
        } catch (e: Throwable) {
            promise.resolve(false)
        }
    }

    // ------------------------------------------------------------------ PDF (PdfRenderer de Android)

    @ReactMethod
    fun pdfPageCount(path: String, promise: Promise) {
        pdfIo.execute {
            var pfd: ParcelFileDescriptor? = null
            var renderer: PdfRenderer? = null
            try {
                pfd = ParcelFileDescriptor.open(File(path), ParcelFileDescriptor.MODE_READ_ONLY)
                renderer = PdfRenderer(pfd)
                promise.resolve(renderer.pageCount)
            } catch (e: SecurityException) {
                promise.reject("E_PDF", "El PDF está protegido con contraseña", e)
            } catch (e: Throwable) {
                promise.reject("E_PDF", "No se pudo abrir el PDF: " + (e.message ?: "formato no válido"), e)
            } finally {
                try { renderer?.close() } catch (ignored: Throwable) {}
                try { pfd?.close() } catch (ignored: Throwable) {}
            }
        }
    }

    @ReactMethod
    fun pdfRenderPage(path: String, index: Int, width: Int, promise: Promise) {
        pdfIo.execute {
            var pfd: ParcelFileDescriptor? = null
            var renderer: PdfRenderer? = null
            try {
                val src = File(path)
                val w = width.coerceIn(200, 2000)
                val dir = File(ctx.cacheDir, "pdf")
                dir.mkdirs()
                val key = (src.absolutePath + src.lastModified()).hashCode().toString(16)
                val out = File(dir, "${key}_${index}_$w.jpg")

                pfd = ParcelFileDescriptor.open(src, ParcelFileDescriptor.MODE_READ_ONLY)
                renderer = PdfRenderer(pfd)
                val page = renderer.openPage(index)
                try {
                    val h = (w.toFloat() * page.height / page.width).toInt().coerceAtLeast(1)
                    if (!out.exists()) {
                        val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
                        bmp.eraseColor(Color.WHITE)
                        page.render(bmp, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                        FileOutputStream(out).use { bmp.compress(Bitmap.CompressFormat.JPEG, 92, it) }
                        bmp.recycle()
                    }
                    val m = Arguments.createMap()
                    m.putString("path", out.absolutePath)
                    m.putInt("width", w)
                    m.putInt("height", h)
                    promise.resolve(m)
                } finally {
                    page.close()
                }
            } catch (e: Throwable) {
                promise.reject("E_PDF", "No se pudo mostrar la página: " + (e.message ?: ""), e)
            } finally {
                try { renderer?.close() } catch (ignored: Throwable) {}
                try { pfd?.close() } catch (ignored: Throwable) {}
            }
        }
    }

    @ReactMethod
    fun clearPdfCache(promise: Promise) {
        pdfIo.execute {
            try {
                File(ctx.cacheDir, "pdf").deleteRecursively()
            } catch (ignored: Throwable) {
            }
            promise.resolve(true)
        }
    }
}
