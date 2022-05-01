import _ from 'lodash'
import { getWeightedRandomPieceIndex } from 'src/core/server/board'
import { NonEmptyArray, Piece, Type } from 'src/gameTypes'

describe('getWeightedRandomPieceIndex', () => {
  test('produces correct distribution', () => {
    const pieces = _.times<Piece>(100, () => ({
      id: _.uniqueId('piece'),
      rotation: 0,
      type: 'straight',
    }))
      .concat(
        _.times<Piece>(100, () => ({
          id: _.uniqueId('piece'),
          rotation: 0,
          type: 't-shape',
        }))
      )
      .concat(
        _.times<Piece>(100, () => ({
          id: _.uniqueId('piece'),
          rotation: 0,
          type: 'corner',
        }))
      ) as NonEmptyArray<Piece>

    const chosenTypes: Type[] = []
    _.times(10000).forEach(() => {
      const index = getWeightedRandomPieceIndex(pieces)
      chosenTypes.push(pieces[index].type)
    })
    const counts: Record<Type, number> = {
      corner: 0,
      't-shape': 0,
      straight: 0,
    }
    chosenTypes.forEach((type) => {
      counts[type]++
    })
    expect(Math.abs(10000 * 0.9 - counts['t-shape'])).toBeLessThan(500)
    expect(Math.abs(10000 * 0.05 - counts['straight'])).toBeLessThan(150)
    expect(Math.abs(10000 * 0.05 - counts['corner'])).toBeLessThan(150)
    console.log(counts)
  })
})

export {}
