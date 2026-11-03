import { StyleSheet } from 'react-native'
import colors from '../../constants/colors'

const styles = StyleSheet.create({
    container: {
        padding: 16,
    },
    imagesLabel: {
        marginTop: 20,
        marginBottom: 8,
        fontWeight: '600',
    },
    imageGrid: {
        flexWrap: 'wrap',
        gap: 10,
    },
    imageWrapper: {
        width: 96,
        height: 96,
        borderRadius: 10,
        overflow: 'hidden',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    removeButton: {
        position: 'absolute',
        top: 4,
        right: 4,
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    addImage: {
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: colors.primary,
        backgroundColor: colors.secondaryLight,
    },
    uploadButton: {
        marginTop: 24,
    },
})

export default styles
