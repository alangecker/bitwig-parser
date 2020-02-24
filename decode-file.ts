import File from './File'
import Parser from './Parser'

if(!process.argv[2]) {
    console.error('please specify a filename')
    process.exit(1)
}
const file = new File(process.argv[2])
const reader = new Parser(file)

console.log(reader.decode())