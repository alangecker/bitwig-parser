import { class_names, field_names } from './names'
import File from './File'

type Field = Obj|string|Buffer|number


function PascalCase(str: string) {
    return str[0].toUpperCase()+str.slice(1)
    .replace(/\./g, '_')
    .replace(/_([a-z])/g, (s,a) => a.toUpperCase())
}

class BWFile {
    fileFormatVersion: number
    serializationFormatId: number
    documentVersionNumber: number
    ressourcesOffset: number
    meta: any = {}
    objects: any
}

class Obj {}
const classes: {[id: string]: typeof Obj} = {}
for(let classId in class_names) {
    let c: typeof Obj
    let name = PascalCase(class_names[classId])
        

    
    eval(`c = class ${name} extends Obj {}`)
    classes[classId] = c
}
class Map {}
class Route {}

export default class Parser {
    file: File
    constructor(file: File) {
        this.file = file
    }
    readObject(): Obj {
        const classId = this.file.read32BE()
        if(classId == 3) {
            // end of array
            return null
        }
        if(classId == 1) {
            return 'OBJECT_REFRENCE:'+this.file.read32BE()
        }
        let obj: Obj
        if(classes[classId]) {
            obj = new classes[classId]
        } else {
            console.warn(`unknown classId ${classId}`)
            obj = new Obj
        }
        while(true) {
            const propertyId = this.file.read32BE()
            if(propertyId == 0x00) {
                // end of object
                break            
            }
            let key = field_names[propertyId]
            if(!key) {
                console.warn(`unknown propertyId ${propertyId}`)
                key = propertyId
            }

            obj[key] = this.parseField()
            
        }
        return obj

    }
    readString(): string {
        const f = this.file
        let strLen = f.read32BE()
        let str = strLen ? f.readString(strLen) : ''

        return str
    }
    readUUID(): string {
        const buf = this.file.readBuffer(16)
        const hex = buf.toString('hex')
        const uuid =  [
            hex.slice(0,8),
            hex.slice(8,12),
            hex.slice(12,16),
            hex.slice(16,20),
            hex.slice(20)
        ].join('-')
        return uuid
    }
    readMap(): any {
        let map: any = {}
        let subType = this.file.readByte()
        while(subType) {
            if(subType == 0x1) {
                let key = this.readString()
                let value = this.readObject()
                map[key] = value
            } else {
                throw new Error('unknown type in map<string,?>')
            }
            subType = this.file.readByte()
        }
        return map
    }
    readObjectList() {
        let list = []
        while(true) {
            let el = this.readObject()
            if(el === null) {
                break
            }
            list.push(el)
        }
        return list
    }
    parseField(): Field {
        const type = this.file.readByte()
        switch(type) {
            case 0x01:
                return this.file.readByte()
            case 0x02:
                return this.file.read16BE()
            case 0x03:
                return this.file.read32BE()
            case 0x04:
                return this.file.read64BE()
            case 0x05:
                return this.file.readBoolean()
            case 0x06:
                return this.file.readFloat()
            case 0x07:
                return this.file.readDouble()
            case 0x08:
                return this.readString()
            case 0x09:
                return this.readObject()    
            case 0x0a:// Null Object
                return null 
            case 0x0b: // object_ref
                const objId = this.file.read32BE()
                return 'SOME_OBJECT_REF'
            case 0x0c:
                throw new Error('parsing ext_object_ref is not implemented yet')
            case 0x0d: // byte[]
                const len = this.file.read32BE()
                if(len > 16) {
                    const f = File.fromBuffer(this.file.readBuffer(len))
                    const p = new Parser(f)
                    return p.decode()
                } else {
                    return this.file.readBuffer(len)
                }
            case 0x0e:
                throw new Error('parsing int16[] is not implemented yet')
            case 0x0f:
                throw new Error('parsing int32[] is not implemented yet')
            case 0x10:
                throw new Error('parsing int64[] is not implemented yet')
            case 0x11:
                throw new Error('parsing bool[] is not implemented yet')
            case 0x12:
                return this.readObjectList()
            case 0x14:
                return this.readMap()
            case 0x15:
                return this.readUUID()
            case 0x16:
                // TODO: parse color
                return this.file.readBuffer(16)
            case 0x17:
                throw new Error('parsing float[] is not implemented yet')
            case 0x18:
                throw new Error('parsing double[] is not implemented yet')
            case 0x19: // string[]
                const arrLen = this.file.read32BE()
                let arr = []
                for(let i=0;i<arrLen;i++) {
                    arr.push(this.readString())
                }
                return arr
                // throw new Error('parsing string[] is not implemented yet')

            case 0x1a: // relative_ref
                const sub = this.file.read32BE()
                if(sub == 0x90) {
                    this.file.pos -= 4
                    const route: any = new Route
                    route.obj = this.readObject()
                    route.str = this.readString()
                    return route
                } else if (sub == 0x01) {
                    const route: any = new Route
                    route.int = this.file.read32BE()
                    route.str = this.readString()
                    return route
                } else {
                    throw new Error(`unknown relative_ref sub (${sub})`)
                }

        }
        throw new Error(`don't understand type 0x${type.toString(16)} @ ${this.file.pos} / 0x${this.file.pos.toString(16)}`)
    }
    decode() {
        console.log(this.file.body)
        const res = new BWFile
        const magicNumber = this.file.read32BE()
        res.fileFormatVersion = this.file.readHexAsInt(4) 
        res.serializationFormatId = this.file.readHexAsInt(4);
        res.documentVersionNumber = this.file.readHexAsInt(4)
        let objectOffset = -1;
        if (res.fileFormatVersion >= 1) {
            objectOffset = this.file.readHexAsInt(8);
        }
        if (res.fileFormatVersion == 2) {
            // throw away some bytes
            this.file.readHexAsInt(4)
            this.file.readHexAsInt(16)
        }
        const ressourcesOffset = this.file.readHexAsInt(16)
        console.log(res.documentVersionNumber)
        if(![0x00, 0x01, 0x04].includes(res.documentVersionNumber)) {
            this.file.goTo(0x3A)
            let drained = false
            while(!drained) {
                let key = this.readString()
                let value = this.parseField()
                res.meta[key] = value
                // console.log({value})
                // console.log(this.file.readBuffer(4))
                if(this.file.read32BE() === 0x00) {
                    drained = true
                }
            }
    
        }

        if(objectOffset) {
            this.file.goTo(objectOffset)
            res.objects = this.readObject()
        }
        return res
    }
}
