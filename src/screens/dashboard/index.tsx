
import React from 'react'
import { AppButton, AppContainer, AppText, AppView } from '../../components'
import styles from './style'

const Dashboard = () => {
    const onUploadReport = () => {
        // TODO: navigate to upload report screen
    }

    return (
        <AppContainer>
            <AppView style={styles.container}>
                <AppText>
                    This is Dashboard
                </AppText>
                <AppButton
                    title="Upload Report"
                    onPress={onUploadReport}
                    style={styles.uploadButton}
                />
            </AppView>
        </AppContainer>
    )
}

export default Dashboard
