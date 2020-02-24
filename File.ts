import * as fs from 'fs'

export default class File {
    pos = 0
    body: Buffer
    constructor(fileName?: string) {
        if(fileName) this.body = fs.readFileSync(fileName)
    }
    static fromBuffer(buf: Buffer): File {
        const file = new File
        file.body = buf
        return file
    }
    goTo(pos: number) {
        this.pos = pos
    }
    readByte(): number {
        let byte = this.body.readInt8(this.pos)
        this.pos++
        return byte
    }
    read16BE(): number {
        return (this.readByte() & 0xFF) << 8 | (this.readByte() & 0xFF)
    }
    read32BE(): number {
        return (this.readByte() & 0xFF) << 24 | (this.readByte() & 0xFF) << 16 | (this.readByte() & 0xFF) << 8 | (this.readByte() & 0xFF);
    }
    read64BE(): bigint {
        const buf = this.readBuffer(8)
        return buf.readBigInt64BE()        
    }
    readBuffer(len: number) :Buffer {
        let buf = this.body.slice(this.pos, this.pos+len)
        this.pos += len
        return buf
    }
    readString(len: number): string {
        let str = ''
        for(let i=0;i<len;i++) {
            str += String.fromCharCode(this.readByte())
        }
        return str
    }
    readHexAsInt(len: number): number {
        return parseInt(this.readString(len), 16)
    }
    readBoolean(): boolean {
        return this.readByte() ? true : false
    }
    readFloat(): number {
        const buf = this.readBuffer(4)
        return buf.readFloatBE(0)
    }
    readDouble(): number {
        const buf = this.readBuffer(8)
        const f = buf.readDoubleBE(0)
        return f
    }
    
}