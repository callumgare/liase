export default function (originalSource) {
  const source = Object.assign({}, originalSource)

  if (!source.name) {
    throw new Error('Source is missing a name')
  }

  if (!source.capabilities) {
    throw new Error('Source is missing capabilities')
  }

  return source
}
