/* eslint-disable @typescript-eslint/naming-convention */
import { normalZoom, TransferPoint } from 'digital-fuesim-manv-shared';
import type Point from 'ol/geom/Point';
import type VectorLayer from 'ol/layer/Vector';
import type VectorSource from 'ol/source/Vector';
import type { ApiService } from 'src/app/core/api.service';
import type OlMap from 'ol/Map';
import type { Store } from '@ngrx/store';
import type { AppState } from 'src/app/state/app.state';
import type { Feature } from 'ol';
import type { TranslateEvent } from 'ol/interaction/Translate';
import Style from 'ol/style/Style';
import Icon from 'ol/style/Icon';
import OlText from 'ol/style/Text';
import Fill from 'ol/style/Fill';
import type { WithPosition } from '../../utility/types/with-position';
import { ElementFeatureManager } from './element-feature-manager';

export class TransferPointFeatureManager extends ElementFeatureManager<
    WithPosition<TransferPoint>
> {
    constructor(
        store: Store<AppState>,
        olMap: OlMap,
        layer: VectorLayer<VectorSource<Point>>,
        apiService: ApiService
    ) {
        super(store, olMap, layer, (targetPosition, transferPoint) => {
            apiService.proposeAction({
                type: '[TransferPoint] Move TransferPoint',
                transferPointId: transferPoint.id,
                targetPosition,
            });
        });
    }

    private cachedStyle?: {
        currentZoom: number;
        style: Style;
    };

    /**
     *
     * @param feature The feature that should be styled
     * @param currentZoom This is for some reason also called `resolution` in the ol typings
     * @returns The style that should be used for the feature
     */
    // This function should be as efficient as possible, because it is called per feature on each rendered frame
    private getStyle(feature: Feature<Point>, currentZoom: number) {
        // TODO: transferPoint.image should be used here
        if (this.cachedStyle?.currentZoom !== currentZoom) {
            const element = this.getElementFromFeature(feature);
            this.cachedStyle = {
                currentZoom,
                style: new Style({
                    image: new Icon({
                        src: TransferPoint.image.url,
                        scale:
                            TransferPoint.image.height /
                            (currentZoom * normalZoom) /
                            // TODO: remove this hack, look at height in transfer-point.svg, is also 102
                            102,
                    }),
                    text: new OlText({
                        text: element?.value.internalName,
                        scale: 0.2 / currentZoom,
                        fill: new Fill({
                            color: '#FEFEFE',
                        }),
                    }),
                }),
            };
        }
        return this.cachedStyle.style;
    }

    public override createFeature(element: WithPosition<TransferPoint>): void {
        super.createFeature(element);
        // Because the feature is already added in the super method, there is a short flickering
        const feature = this.getFeatureFromElement(element)!;
        feature.setStyle((thisFeature, currentZoom) =>
            this.getStyle(thisFeature as Feature<Point>, currentZoom)
        );
    }

    public override onFeatureDrop(
        dropEvent: TranslateEvent,
        droppedFeature: Feature<any>,
        droppedOnFeature: Feature<Point>
    ) {
        const droppedElement = this.getElementFromFeature(droppedFeature);
        const droppedOnVehicle = this.getElementFromFeature(droppedOnFeature);
        if (!droppedElement || !droppedOnVehicle) {
            console.error('Could not find element for the features');
            return false;
        }
        // TODO: Implement transferring of the dropped element
        return false;
    }

    override unsupportedChangeProperties = new Set([
        'id',
        'internalName',
    ] as const);
}
