import React, { useEffect, useRef, useState } from 'react'
import { Alert, AppState, Image, Linking, ScrollView, TouchableOpacity } from 'react-native'
import { Asset, ImagePickerResponse, launchCamera, launchImageLibrary } from 'react-native-image-picker'
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons/static'
import { AppButton, AppContainer, AppText, AppTextInput, AppView, ImagePickerModal, NetworkBanner } from '../../components'
import { MAX_DESCRIPTION_LENGTH, MAX_IMAGES } from '../../delivery/limits'
import { triggerProcessingAndDelivery } from '../../delivery/deliveryService'
import { saveReportLocally, validateReport } from '../../features/compose/saveReport'
import { explainCameraPermission, isCameraPermissionGranted, requestCameraPermission } from '../../permissions/cameraPermission'
import { RootStackScreenProps, ROUTES } from '../../navigation/types'
import colors from '../../constants/colors'
import styles from './style'

const UploadReport = ({ navigation }: RootStackScreenProps<typeof ROUTES.UPLOAD_REPORT>) => {
    const [description, setDescription] = useState('')
    const [images, setImages] = useState<Asset[]>([])
    const [pickerVisible, setPickerVisible] = useState(false)
    const [showErrors, setShowErrors] = useState(false)
    // True while the photos are copied into app storage and the report row is committed
    const [saving, setSaving] = useState(false)
    // Set when the user went to Settings to enable the camera, so we can re-check on return
    const awaitingCameraSettings = useRef(false)

    const remaining = MAX_IMAGES - images.length
    const descriptionError = showErrors && !description.trim() ? 'A description is required.' : undefined
    const imagesError = showErrors && images.length === 0 ? 'Add at least one photo.' : undefined

    const handlePickerResponse = (response: ImagePickerResponse) => {
        if (response.didCancel) {
            return
        }
        if (response.errorCode === 'permission') {
            Alert.alert('Permission needed', 'Allow access in Settings to add photos.', [
                { text: 'Not now', style: 'cancel' },
                { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ])
            return
        }
        if (response.errorCode) {
            Alert.alert('Could not add photo', response.errorMessage ?? (response.errorCode === 'camera_unavailable' ? 'No camera is available on this device.' : 'Unable to pick image'))
            return
        }
        const assets = (response.assets ?? []).filter(asset => !!asset.uri)
        setImages(prev => {
            const room = MAX_IMAGES - prev.length
            if (assets.length > room) {
                Alert.alert('Photo limit', `Only ${room} more photo${room === 1 ? '' : 's'} could be added. A report can have at most ${MAX_IMAGES}.`)
            }
            return [...prev, ...assets.slice(0, Math.max(0, room))]
        })
    }

    const openCamera = async () => handlePickerResponse(await launchCamera({ mediaType: 'photo', saveToPhotos: false }))

    // Permission granted in Settings takes effect as soon as the user comes back, without a restart
    useEffect(() => {
        const subscription = AppState.addEventListener('change', async state => {
            if (state !== 'active' || !awaitingCameraSettings.current) {
                return
            }
            awaitingCameraSettings.current = false
            if (await isCameraPermissionGranted()) {
                openCamera()
            }
        })
        return () => subscription.remove()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const onCamera = async () => {
        setPickerVisible(false)
        const outcome = await requestCameraPermission()
        if (outcome !== 'granted') {
            explainCameraPermission(outcome, () => {
                awaitingCameraSettings.current = true
            })
            return
        }
        openCamera()
    }

    const onGallery = async () => {
        setPickerVisible(false)
        handlePickerResponse(await launchImageLibrary({ mediaType: 'photo', selectionLimit: remaining }))
    }

    const onAddImages = () => {
        if (remaining <= 0) {
            Alert.alert('Limit reached', `A report can have at most ${MAX_IMAGES} photos. Remove one to add another.`)
            return
        }
        setPickerVisible(true)
    }

    const onRemoveImage = (uri?: string) => {
        setImages(prev => prev.filter(image => image.uri !== uri))
    }

    const onSave = async () => {
        setShowErrors(true)
        const invalid = validateReport(description, images.length)
        if (invalid) {
            Alert.alert('Report incomplete', invalid)
            return
        }

        try {
            setSaving(true)
            // Resolves only after the report row and photo copies are committed on the device
            await saveReportLocally(description, images)
            triggerProcessingAndDelivery()
            navigation.goBack()
            Alert.alert('Saved on this device', 'Waiting to upload. It will upload automatically when a connection is available. Track it in the Outbox.')
        } catch (error) {
            Alert.alert('Not saved', `${error instanceof Error ? error.message : 'Something went wrong'}\n\nYour report was not stored. Please try again.`)
        } finally {
            setSaving(false)
        }
    }

    return (
        <AppContainer edges={['bottom', 'left', 'right']}>
            <NetworkBanner />
            <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
                <AppTextInput
                    label="Description (required)"
                    placeholder="Describe what you observed..."
                    value={description}
                    onChangeText={setDescription}
                    onBlur={() => description.length > 0 && setShowErrors(true)}
                    multiline
                    maxLength={MAX_DESCRIPTION_LENGTH}
                    editable={!saving}
                    error={descriptionError}
                    accessibilityLabel="Report description, required"
                />

                <AppText style={styles.imagesLabel}>
                    Photos ({images.length}/{MAX_IMAGES}) · required
                </AppText>
                <AppView row style={styles.imageGrid}>
                    {images.map(image => (
                        <AppView key={image.uri} style={styles.imageWrapper}>
                            <Image source={{ uri: image.uri }} style={styles.image} />
                            {!saving && (
                                <TouchableOpacity
                                    style={styles.removeButton}
                                    onPress={() => onRemoveImage(image.uri)}
                                    hitSlop={10}
                                    accessibilityRole="button"
                                    accessibilityLabel="Remove photo"
                                >
                                    <MaterialDesignIcons name="close" size={16} color={colors.white} />
                                </TouchableOpacity>
                            )}
                        </AppView>
                    ))}
                    {remaining > 0 && !saving && (
                        <TouchableOpacity
                            style={[styles.imageWrapper, styles.addImage]}
                            onPress={onAddImages}
                            accessibilityRole="button"
                            accessibilityLabel="Add photo from camera or gallery"
                        >
                            <MaterialDesignIcons name="camera-plus" size={28} color={colors.primary} />
                        </TouchableOpacity>
                    )}
                </AppView>
                {remaining <= 0 && (
                    <AppText style={styles.hint}>Maximum of {MAX_IMAGES} photos reached. Remove one to add another.</AppText>
                )}
                {imagesError && <AppText style={styles.error}>{imagesError}</AppText>}
                <AppText style={styles.hint}>
                    Large photos are resized and compressed on this device to 5 MB or less before upload.
                </AppText>

                <AppButton
                    title="Save report"
                    onPress={onSave}
                    loading={saving}
                    style={styles.uploadButton}
                />
            </ScrollView>

            <ImagePickerModal
                visible={pickerVisible}
                onClose={() => setPickerVisible(false)}
                onCamera={onCamera}
                onGallery={onGallery}
            />
        </AppContainer>
    )
}

export default UploadReport
